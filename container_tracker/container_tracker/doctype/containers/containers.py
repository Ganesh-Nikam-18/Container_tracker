# Copyright (c) 2026, Dexciss Technology Pvt Ltd and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Containers(Document):
	def after_insert(self):
		# Automatically set the barcode to the Container's own ID upon creation
		if not self.container_barcode:
			self.db_set('container_barcode', self.name)
