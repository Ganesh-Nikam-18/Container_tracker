# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _

class ContainerMovements(Document):
	def validate(self):
		self.validate_locations()

	def validate_locations(self):
		for item in self.get("containers"):
			if item.source_location and item.target_location and item.source_location == item.target_location:
				frappe.throw(_("Row #{0}: Source Location and Target Location cannot be the same").format(item.idx))
