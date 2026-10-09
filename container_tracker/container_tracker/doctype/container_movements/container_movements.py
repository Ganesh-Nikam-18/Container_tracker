# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, add_days, getdate, nowdate
from frappe import _

OUTBOUND_PURPOSES = ["Send to Customer", "Send to Supplier", "Return to Supplier"]
INBOUND_PURPOSES = ["Receive from Customer", "Receive from Supplier"]

class ContainerMovements(Document):
	def validate(self):
		self.validate_party_type()
		self.validate_locations()
		self.validate_hydro_test()
		self.validate_reservation_conflicts()

	def validate_reservation_conflicts(self):
		"""
		Ensure containers reserved for specific documents cannot be moved for another document.
		"""
		for item in self.get("containers"):
			active_res = frappe.db.sql("""
				SELECT cre.name, cre.reference_document_type, cre.reference_document_name, cre.party
				FROM `tabContainer Reservation Entry` cre
				JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
				WHERE cri.container = %s
				  AND cre.docstatus = 1
				  AND cre.status = 'Active'
				LIMIT 1
			""", (item.container,), as_dict=True)

			if active_res:
				res = active_res[0]
				if res.reference_document_name and res.reference_document_name != self.reference_document_name:
					frappe.throw(_(
						"Row #{0}: Container <b>{1}</b> is reserved for <b>{2} {3}</b> ({4}). "
						"It cannot be used for a movement of a different document."
					).format(item.idx, item.container, res.reference_document_type, res.reference_document_name, res.party))
				elif res.party and self.party and res.party != self.party:
					frappe.throw(_(
						"Row #{0}: Container <b>{1}</b> is reserved for party <b>{2}</b>. "
						"It cannot be used for a movement to {3}."
					).format(item.idx, item.container, res.party, self.party))

	def fulfill_reservations_on_submit(self):
		"""Mark matching active container reservations as Fulfilled upon movement submission."""
		for item in self.get("containers"):
			active_res = frappe.db.sql("""
				SELECT cre.name
				FROM `tabContainer Reservation Entry` cre
				JOIN `tabContainer Reservation Item` cri ON cri.parent = cre.name
				WHERE cri.container = %s
				  AND cre.docstatus = 1
				  AND cre.status = 'Active'
			""", (item.container,), as_dict=True)

			for res in active_res:
				frappe.db.set_value("Container Reservation Entry", res.name, "status", "Fulfilled")

	def on_submit(self):
		self.update_containers()
		self.make_ledger_entries(is_cancelled=0)
		self.fulfill_reservations_on_submit()

	def validate_party_type(self):
		if not self.party_type and self.purpose:
			if "Customer" in self.purpose:
				self.party_type = "Customer"
			elif "Supplier" in self.purpose:
				self.party_type = "Supplier"
			else:
				self.party_type = "Company"


	def validate_locations(self):
		"""Ensure container rows have basic data populated including target_location."""
		for item in self.get("containers"):
			actual_location = frappe.db.get_value("Containers", item.container, "current_location")
			if not actual_location:
				frappe.db.set_value("Containers", item.container, "current_location", "Plant Main Store")

			if not item.target_location:
				if self.purpose in OUTBOUND_PURPOSES:
					item.target_location = self.party or "External"
				elif self.purpose in INBOUND_PURPOSES or self.purpose == "Return from Maintenance":
					item.target_location = "Plant Main Store"
				elif self.purpose == "Move to Filling":
					item.target_location = "Filling Station"
				elif self.purpose == "Return from Filling":
					item.target_location = "Finished Goods Yard"
				elif self.purpose == "Move to Maintenance":
					item.target_location = "Maintenance Shop"
				elif self.purpose == "Scrap / Decommission":
					item.target_location = "Scrap Yard"
				else:
					item.target_location = self.party or "Plant Main Store"

	def validate_hydro_test(self):
		"""
		Trip-date aware hydro test validation per the design spec.
		For outbound movements the hydro test MUST remain valid through the
		Expected Return Date, not just today.  Dispatching a container whose
		test expires before it is due back is blocked with a clear message.
		"""
		if self.purpose not in OUTBOUND_PURPOSES:
			return

		# Use expected_return_date if provided, else fall back to 30-day buffer
		return_date = getdate(self.get("expected_return_date")) if self.get("expected_return_date") else add_days(getdate(), 30)

		for item in self.get("containers"):
			hydro_expiry = frappe.db.get_value("Containers", item.container, "test_due")

			if not hydro_expiry:
				# No test date set — warn but allow (configurable in future via settings)
				frappe.msgprint(
					_("Row #{0}: Container {1} has no Hydro Test date recorded. Proceeding with caution.").format(
						item.idx, item.container
					),
					indicator="orange", alert=True
				)
				continue

			hydro_expiry_date = getdate(hydro_expiry)
			today = getdate()

			# Already expired today
			if hydro_expiry_date <= today:
				frappe.throw(_(
					"Row #{0}: Container {1} has an <b>expired Hydro Test</b> ({2}). "
					"It cannot be dispatched."
				).format(item.idx, item.container, hydro_expiry))

			# Test expires before expected return date
			if hydro_expiry_date < return_date:
				if self.get("expected_return_date"):
					frappe.throw(_(
						"Row #{0}: Container {1} — Hydro Test expires on <b>{2}</b>, "
						"but the Expected Return Date is <b>{3}</b>. "
						"The container cannot be dispatched because it will be out of test "
						"before it returns. Please arrange a hydro test before dispatch, "
						"or shorten the trip duration."
					).format(item.idx, item.container, hydro_expiry, self.expected_return_date))
				else:
					# 30-day buffer fallback
					frappe.throw(_(
						"Row #{0}: Container {1} Hydro Test expires within 30 days ({2}). "
						"It cannot be dispatched. Set an Expected Return Date to get a "
						"precise trip-date check, or arrange a hydro test first."
					).format(item.idx, item.container, hydro_expiry))

	def on_submit(self):
		self.update_containers()
		self.make_ledger_entries(is_cancelled=0)

	def on_cancel(self):
		self.revert_containers()
		self.make_ledger_entries(is_cancelled=1)

	def update_containers(self):
		for item in self.get("containers"):
			new_status, new_custodian = self.determine_new_state(item.container)

			container_doc = frappe.get_doc("Containers", item.container)
			# Set current_location based on movement purpose
			if self.purpose in OUTBOUND_PURPOSES:
				container_doc.db_set('current_location', self.party or 'External')
			elif self.purpose in INBOUND_PURPOSES:
				container_doc.db_set('current_location', 'Plant Main Store')
			elif self.purpose == 'Move to Filling':
				container_doc.db_set('current_location', 'Filling Station')
			elif self.purpose == 'Return from Filling':
				container_doc.db_set('current_location', 'Finished Goods Yard')
			elif self.purpose == 'Move to Maintenance':
				container_doc.db_set('current_location', 'Maintenance Shop')
			elif self.purpose == 'Return from Maintenance':
				container_doc.db_set('current_location', 'Plant Main Store')
			elif self.purpose == 'Scrap / Decommission':
				container_doc.db_set('current_location', 'Scrap Yard')
			else:
				container_doc.db_set('current_location', 'Plant Main Store')
			container_doc.db_set('status', new_status)

			if new_custodian:
				container_doc.db_set('custodian', new_custodian)
				if new_custodian == "Company":
					container_doc.db_set('custodian_type', "Company")
				elif self.party_type:
					container_doc.db_set('custodian_type', self.party_type)

			if item.item_code:
				container_doc.db_set('current_item', item.item_code)

			# Track holder_since and dispatch_date for days-held calculation
			if self.purpose in OUTBOUND_PURPOSES:
				# Container leaving our plant to a party
				container_doc.db_set('holder_since', nowdate())
				container_doc.db_set('dispatch_date', self.transaction_date or nowdate())
			elif self.purpose in INBOUND_PURPOSES:
				# Container returning to plant — clear holding dates
				container_doc.db_set('holder_since', None)
				container_doc.db_set('dispatch_date', None)

	def revert_containers(self):
		for item in self.get("containers"):
			# Revert location and status from ledger entry if possible,
			# otherwise fall back to fill_status-based inference
			prev_entry = frappe.db.get_value(
				"Container Ledger Entry",
				{"containers_movement": self.name, "is_cancelled": 0},
				["status_before"],
				as_dict=True
			)

			container_doc = frappe.get_doc("Containers", item.container)
			container_doc.db_set('current_location', 'Plant Main Store')

			if container_doc.fill_status == "Empty":
				container_doc.db_set('status', "Available")
			else:
				container_doc.db_set('status', "Filled")

			container_doc.db_set('custodian', None)
			container_doc.db_set('custodian_type', None)

			# Clear holding dates if the movement being cancelled was outbound
			if self.purpose in OUTBOUND_PURPOSES:
				container_doc.db_set('holder_since', None)
				container_doc.db_set('dispatch_date', None)
				container_doc.db_set('return_to_owner', None)

	def determine_new_state(self, container):
		status = "Available"
		custodian = "Company"

		fill_status = frappe.db.get_value("Containers", container, "fill_status")

		if self.purpose == "Send to Customer":
			status = "With Customer"
			custodian = self.party
		elif self.purpose in ["Send to Supplier", "Return to Supplier"]:
			status = "With Supplier"
			custodian = self.party
		elif self.purpose in ["Receive from Customer", "Receive from Supplier", "Internal Transfer"]:
			status = "Filled" if fill_status != "Empty" else "Available"
			custodian = "Company"
		elif self.purpose == "Move to Filling":
			status = "In Filling"
		elif self.purpose == "Return from Filling":
			status = "Filled" if fill_status != "Empty" else "Available"
		elif self.purpose == "Move to Maintenance":
			status = "Damaged"
		elif self.purpose == "Return from Maintenance":
			status = "Available"
		elif self.purpose == "Scrap / Decommission":
			status = "Scrapped"

		return status, custodian

	def make_ledger_entries(self, is_cancelled=0):
		"""Create an immutable Container Ledger Entry for every container row."""
		for item in self.get("containers"):
			self._insert_ledger_entry(item, is_cancelled=is_cancelled)

	def _insert_ledger_entry(self, item, is_cancelled=0):
		container_data = frappe.db.get_value(
			"Containers", item.container,
			["status", "fill_status", "current_item", "custodian"],
			as_dict=True
		) or {}

		party_type = self.party_type
		if not party_type and self.purpose:
			if "Supplier" in self.purpose:
				party_type = "Supplier"
			elif "Customer" in self.purpose:
				party_type = "Customer"

		supplier_name = self.party if party_type == "Supplier" else None
		customer_name = self.party if party_type == "Customer" else None

		# Determine directional entry type and source/target locations
		is_outbound = self.purpose in OUTBOUND_PURPOSES

		if is_cancelled:
			# Reversal entry: direction is flipped and locations are reversed back to plant
			entry_type = "Inward" if is_outbound else "Outward"
			source_location = self.party or "External"
			target_location = "Plant Main Store"
		else:
			entry_type = "Outward" if is_outbound else "Inward"
			source_location = frappe.db.get_value("Containers", item.container, "current_location") or "Plant Main Store"
			target_location = self.party or "Plant Main Store"

		cle = frappe.get_doc({
			"doctype": "Container Ledger Entry",
			"datetime": now_datetime(),
			"container": item.container,
			"entry_type": entry_type,
			"containers_movement": self.name,
			"item_code": item.item_code or container_data.get("current_item"),
			"filled_qty": item.qty if item.qty else 0,
			"party_type": party_type,
			"party": self.party,
			"supplier": supplier_name,
			"customer": customer_name,
			"source_location": source_location,
			"target_location": target_location,
			"reference_document_type": self.reference_document_type or "Container Movements",
			"reference_document_name": self.reference_document_name or self.name,
			"is_cancelled": is_cancelled,
			"status_before": container_data.get("status"),
			"movement_type": self.purpose,
		})
		cle.insert(ignore_permissions=True)
