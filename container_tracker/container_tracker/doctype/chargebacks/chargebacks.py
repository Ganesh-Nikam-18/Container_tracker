# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Chargebacks(Document):
	def on_submit(self):
		self.create_invoice()

	def on_cancel(self):
		self.cancel_invoice()

	def create_invoice(self):
		if not self.amount or self.amount <= 0:
			return

		settings = frappe.get_cached_doc("Container Settings")
		if not settings.penalty_item:
			frappe.throw("Please set a Penalty Item in Container Settings before submitting a Chargeback.")

		company = frappe.defaults.get_user_default("Company")
		if not company:
			company = frappe.db.get_single_value("Global Defaults", "default_company")

		if self.document_type == "Customer":
			invoice = frappe.new_doc("Sales Invoice")
			invoice.customer = self.party
			self.db_set("invoice_type", "Sales Invoice")
		elif self.document_type == "Supplier":
			invoice = frappe.new_doc("Purchase Invoice")
			invoice.supplier = self.party
			invoice.is_return = 1
			self.db_set("invoice_type", "Purchase Invoice")
		else:
			return

		invoice.company = company
		invoice.set_posting_time = 1
		invoice.posting_date = self.posting_date

		invoice.append("items", {
			"item_code": settings.penalty_item,
			"qty": 1,
			"rate": self.amount,
			"description": f"Chargeback for {self.containers_charged} containers from Reconciliation {self.source_reconciliation}"
		})

		invoice.flags.ignore_permissions = True
		invoice.insert()
		invoice.submit()

		self.db_set("invoice_reference", invoice.name)
		frappe.msgprint(f"Created {self.invoice_type} {invoice.name}")

	def cancel_invoice(self):
		if self.invoice_reference and self.invoice_type:
			invoice = frappe.get_doc(self.invoice_type, self.invoice_reference)
			if invoice.docstatus == 1:
				invoice.flags.ignore_permissions = True
				invoice.cancel()
				frappe.msgprint(f"Canceled {self.invoice_type} {invoice.name}")
