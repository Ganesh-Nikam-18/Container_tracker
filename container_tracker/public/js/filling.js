class FillingApp {
    constructor(wrapper) {
        this.$wrapper = $(wrapper);
        this.state = {
            view: 'list', 
            entries: [],
            recentEntries: [],
            scannedContainers: [],
            selectedDeliveryNote: null,
            selectedItem: null,
            operator: frappe.session.user_fullname,
            gasBatch: '',
            
            customer: '-',
            orderedQty: 0,
            alreadyFilledQty: 0,
            pendingQty: 0,
            maxFillCapacity: 0,
            capacityUOM: '',
            containerType: '',
            
            quickPicks: [],
            dnItems: [] 
        };
        
        this.$wrapper.closest('.layout-main-section').css({
            'max-width': '100%',
            'padding': '15px 30px'
        });
        
        this.html5QrcodeScanner = null;
        this.init();
    }

    init() {
        if (typeof Html5QrcodeScanner === 'undefined') {
            let script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode';
            document.head.appendChild(script);
        }
        
        this.fetchData();
        this.render();
    }

    fetchData() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Container Filling Entry',
                fields: ['name', 'posting_date', 'delivery_note', 'customer', 'item', 'containers_filled', 'quantity_posted', 'operator', 'docstatus'],
                limit_page_length: 20,
                order_by: 'creation desc'
            },
            callback: (r) => {
                this.state.entries = r.message || [];
                this.state.recentEntries = this.state.entries.filter(e => e.docstatus === 1).slice(0, 5);
                if (this.state.view === 'list') {
                    this.renderListView();
                } else if (this.state.view === 'scanner') {
                    this.renderRecentEntries();
                }
            }
        });
    }

    render() {
        this.$wrapper.empty();
        if (this.state.view === 'list') {
            this.renderListView();
        } else {
            this.renderScannerView();
        }
    }

    renderListView() {
        this.$wrapper.empty();
        
        let totalEntries = this.state.entries.length;
        let totalContainers = this.state.entries.reduce((acc, val) => acc + (val.containers_filled || 0), 0);
        let totalQty = this.state.entries.reduce((acc, val) => acc + (val.quantity_posted || 0), 0);

        const html = `
            <div class="ct-header-action">
                <button class="ct-btn ct-btn-primary" id="btn-new-entry">+ New</button>
            </div>
            <div class="ct-dashboard-cards">
                <div class="ct-card blue">
                    <div class="ct-card-label">Filling entries</div>
                    <div class="ct-card-value">${totalEntries}</div>
                </div>
                <div class="ct-card green">
                    <div class="ct-card-label">Containers filled</div>
                    <div class="ct-card-value">${totalContainers}</div>
                </div>
                <div class="ct-card purple">
                    <div class="ct-card-label">Quantity posted</div>
                    <div class="ct-card-value">${totalQty.toFixed(1)}</div>
                </div>
            </div>

            <div class="ct-list-view">
                <div class="ct-table-header">
                    <input type="text" class="ct-search-input" placeholder="Search ID, delivery note, customer, item" />
                    <span style="font-size: 12px; color: var(--text-muted);">${totalEntries} records</span>
                </div>
                <table class="ct-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Posting date</th>
                            <th>Delivery note</th>
                            <th>Customer</th>
                            <th>Item</th>
                            <th>Containers</th>
                            <th>Qty posted</th>
                            <th>Operator</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.entries.map(e => `
                            <tr>
                                <td style="color: var(--blue-500); font-weight: 500;">${e.name}</td>
                                <td>${e.posting_date}</td>
                                <td>${e.delivery_note || '-'}</td>
                                <td>${e.customer || '-'}</td>
                                <td>${e.item || '-'}</td>
                                <td>${e.containers_filled || 0}</td>
                                <td>${(e.quantity_posted || 0).toFixed(1)}</td>
                                <td>${e.operator || '-'}</td>
                                <td><span class="status-badge ${e.docstatus === 1 ? 'submitted' : 'draft'}">${e.docstatus === 1 ? 'Submitted' : 'Draft'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        this.$wrapper.html(html);

        this.$wrapper.find('#btn-new-entry').on('click', () => {
            this.state.view = 'scanner';
            this.render();
        });
    }

    renderScannerView() {
        this.$wrapper.empty();
        
        let suggestedCount = 0;
        if(this.state.maxFillCapacity > 0) {
            suggestedCount = Math.floor(this.state.pendingQty / this.state.maxFillCapacity);
        }
        
        let pendingAfter = this.state.pendingQty - (this.state.scannedContainers.length * this.state.maxFillCapacity);
        
        const html = `
            <div class="ct-header-bar">
                <div>
                    <h3 style="margin: 0; font-size: 18px;">Container Filling Entry</h3>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-muted);">Fill gas into tracked containers against a submitted delivery note</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="ct-btn ct-btn-secondary" id="btn-back">Back to list</button>
                    <button class="ct-btn ct-btn-secondary" id="btn-clear">Clear scans</button>
                    <button class="ct-btn ct-btn-primary" id="btn-submit">Submit filling entry</button>
                </div>
            </div>

            <div class="ct-scanner-view" style="display: grid; grid-template-columns: 2.5fr 1fr; gap: 20px;">
                <div class="ct-left-panel">
                    
                    <div class="ct-step-section">
                        <div class="ct-step-title">1 · Select delivery note and item</div>
                        <div class="ct-form-row">
                            <div class="ct-form-group">
                                <div id="dn-control-wrapper"></div>
                            </div>
                            <div class="ct-form-group">
                                <div id="item-control-wrapper"></div>
                            </div>
                        </div>
                        <div class="ct-form-row">
                            <div class="ct-form-group">
                                <label>Filling operator</label>
                                <input type="text" class="ct-input" id="inp-operator" value="${this.state.operator}" />
                            </div>
                            <div class="ct-form-group">
                                <label>Gas batch / lot</label>
                                <input type="text" class="ct-input" id="inp-batch" placeholder="e.g. HE-2608-A" value="${this.state.gasBatch}" />
                            </div>
                        </div>
                        
                        <!-- Context Bar -->
                        <div class="ct-context-bar" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-top: 15px; display: ${this.state.selectedItem ? 'block' : 'none'};">
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                                <div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Ordered</div>
                                    <div style="font-size: 14px; font-weight: 600; margin-top: 5px;">${this.state.orderedQty} ${this.state.capacityUOM}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Already filled</div>
                                    <div style="font-size: 14px; font-weight: 600; margin-top: 5px;">${this.state.alreadyFilledQty} ${this.state.capacityUOM}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Pending</div>
                                    <div style="font-size: 14px; font-weight: 600; margin-top: 5px;">${this.state.pendingQty} ${this.state.capacityUOM}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Max fill for this item</div>
                                    <div style="font-size: 14px; font-weight: 600; margin-top: 5px;">${this.state.containerType || '-'} · ${this.state.maxFillCapacity} ${this.state.capacityUOM} each</div>
                                </div>
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                                Capacity comes from the Container Type master for ${this.state.selectedItem || '-'}
                            </div>
                        </div>
                    </div>

                    <div class="ct-step-section">
                        <div class="ct-step-title">
                            2 · Scan containers
                            <button class="ct-btn ct-btn-secondary" id="btn-camera-scan" style="margin-left: auto; padding: 4px 8px; font-size: 11px; display:flex; align-items:center; gap:5px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg> Camera scan
                            </button>
                        </div>
                        <div class="ct-form-row" style="grid-template-columns: 1fr 1fr;">
                            <div>
                                <label style="font-size: 12px; color: var(--text-muted);">Handheld / Bluetooth scanner</label>
                                <div class="ct-barcode-scanner" style="margin-top: 5px;">
                                    <input type="text" class="ct-input" id="inp-scan" placeholder="Scan or type CYL-01001" />
                                    <button class="ct-btn ct-btn-secondary" id="btn-add-scan">Add</button>
                                </div>
                                <p style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">Keep this field focused — the scanner types the ID and presses Enter</p>
                                
                                <div style="margin-top: 15px; display: ${this.state.quickPicks.length > 0 ? 'block' : 'none'};">
                                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Quick pick — available ${this.state.containerType || 'containers'}</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px;" id="quick-pick-container">
                                        ${this.state.quickPicks.map(qp => `
                                            <button class="ct-quick-pick-btn" data-id="${qp.name}">${qp.name}</button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            <div class="ct-scanner-viewfinder" id="camera-viewfinder" style="overflow: hidden; position: relative;">
                                <div id="qr-reader" style="width: 100%;"></div>
                                <div id="camera-placeholder">Camera off</div>
                            </div>
                        </div>
                    </div>

                    <div class="ct-step-section">
                        <div class="ct-step-title">3 · Containers in this filling (${this.state.scannedContainers.length})</div>
                        <div class="ct-scanned-list" id="scanned-list-container" style="${this.state.scannedContainers.length > 0 ? 'padding: 0; background: white;' : ''}">
                            ${this.state.scannedContainers.length === 0 ? 
                                `Scan a container to begin. Suggested containers for the pending quantity: <strong>${suggestedCount}</strong>` : 
                                this.renderScannedContainersTable()
                            }
                        </div>
                    </div>

                </div>

                <div class="ct-right-panel">
                    <div class="ct-summary-panel">
                        <h4 style="margin-top: 0; margin-bottom: 20px;">Filling summary</h4>
                        <div class="ct-summary-item">
                            <span class="ct-summary-label">Containers scanned</span>
                            <span class="ct-summary-val" id="sum-scanned">${this.state.scannedContainers.length}</span>
                        </div>
                        <div class="ct-summary-item">
                            <span class="ct-summary-label">Suggested containers</span>
                            <span class="ct-summary-val" id="sum-suggested">${suggestedCount}</span>
                        </div>
                        <div class="ct-summary-item">
                            <span class="ct-summary-label">Quantity to post</span>
                            <span class="ct-summary-val" id="sum-qty">${(this.state.scannedContainers.length * this.state.maxFillCapacity).toFixed(1)} ${this.state.capacityUOM}</span>
                        </div>
                        <div class="ct-summary-item">
                            <span class="ct-summary-label">Pending after posting</span>
                            <span class="ct-summary-val" id="sum-pending-after">${pendingAfter.toFixed(1)} ${this.state.capacityUOM}</span>
                        </div>
                        <div class="ct-summary-item" style="border-bottom: none;">
                            <span class="ct-summary-label">Customer</span>
                            <span class="ct-summary-val" id="sum-customer">${this.state.customer}</span>
                        </div>
                    </div>

                    <div class="ct-summary-panel" style="margin-top: 20px;">
                        <h4 style="margin-top: 0; margin-bottom: 15px;">What gets posted in ERPNext</h4>
                        <ul style="font-size: 11px; color: var(--text-muted); padding-left: 20px; line-height: 1.6; margin: 0;">
                            <li><span style="color:var(--green-500)">✓</span> Stock Entry (Material Issue) reduces the gas item from the filling plant warehouse.</li>
                            <li><span style="color:var(--green-500)">✓</span> Cylinder / container items are NOT consumed — they stay as fixed assets.</li>
                            <li><span style="color:var(--green-500)">✓</span> One Asset Movement per container: Filling Plant &rarr; Finished Goods.</li>
                            <li><span style="color:var(--green-500)">✓</span> Container Tracker rows are updated with fill qty, batch and delivery note.</li>
                        </ul>
                    </div>
                    
                    <div class="ct-recent-entries" id="recent-entries-container" style="margin-top: 20px;">
                        <!-- Rendered separately -->
                    </div>
                </div>
            </div>
        `;

        this.$wrapper.html(html);
        this.renderRecentEntries();

        // Bind events
        this.$wrapper.find('#btn-back').on('click', () => {
            this.stopCamera();
            this.state.view = 'list';
            this.fetchData();
        });
        
        this.$wrapper.find('#btn-clear').on('click', () => {
            this.state.scannedContainers = [];
            this.renderScannerView();
        });

        this.setupAwesomplete();


        this.$wrapper.find('#btn-add-scan').on('click', () => this.handleScanInput());
        this.$wrapper.find('#inp-scan').on('keypress', (e) => {
            if(e.which === 13) this.handleScanInput();
        });
        
        setTimeout(() => {
            this.$wrapper.find('#inp-scan').focus();
        }, 100);

        this.$wrapper.find('.ct-quick-pick-btn').on('click', (e) => {
            let containerId = $(e.currentTarget).data('id');
            this.processScan(containerId);
        });
        
        this.$wrapper.find('#btn-camera-scan').on('click', () => {
            if(this.html5QrcodeScanner) {
                this.stopCamera();
            } else {
                this.startCamera();
            }
        });

        this.$wrapper.find('#btn-submit').on('click', () => this.submitFillingEntry());
        
        this.$wrapper.find('#inp-operator').on('change', (e) => this.state.operator = $(e.currentTarget).val());
        this.$wrapper.find('#inp-batch').on('change', (e) => this.state.gasBatch = $(e.currentTarget).val());
    }

    startCamera() {
        if (typeof Html5QrcodeScanner === 'undefined') {
            frappe.show_alert({message: 'Camera scanner library is still loading. Try again.', indicator: 'orange'});
            return;
        }
        
        this.$wrapper.find('#camera-placeholder').hide();
        this.$wrapper.find('#btn-camera-scan').html('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Stop camera');
        
        if (!this.html5QrcodeScanner) {
            // Removed qrbox to eliminate the white focus layout overlay
            this.html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10 }, /* verbose= */ false);
            this.html5QrcodeScanner.render((decodedText, decodedResult) => {
                frappe.show_alert({message: 'Barcode scanned!', indicator: 'green'});
                this.processScan(decodedText);
            }, (errorMessage) => {
            });
        }
    }
    
    stopCamera() {
        if(this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear().then(() => {
                this.html5QrcodeScanner = null;
                this.$wrapper.find('#camera-placeholder').show();
                this.$wrapper.find('#btn-camera-scan').html('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg> Camera scan');
            });
        }
    }

    renderRecentEntries() {
        let container = this.$wrapper.find('#recent-entries-container');
        if(!container.length) return;
        
        if (this.state.recentEntries.length === 0) {
            container.html(`
                <div class="ct-summary-panel">
                    <h4 style="margin-top: 0; margin-bottom: 15px;">Recent filling entries</h4>
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0;">No entries submitted yet.</p>
                </div>
            `);
            return;
        }
        
        const html = `
            <div class="ct-summary-panel">
                <h4 style="margin-top: 0; margin-bottom: 15px;">Recent filling entries</h4>
                ${this.state.recentEntries.map(e => `
                    <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-color);">${e.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">${e.delivery_note || '-'} · ${e.item || '-'}</div>
                        </div>
                        <div style="background: #eff6ff; color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">
                            ${e.containers_filled || 0}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.html(html);
    }

    renderScannedContainersTable() {
        return `
            <table class="ct-table" style="text-align: left; background: white; margin: 0; border: none; border-radius: 8px;">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th>Container ID</th>
                        <th>Type</th>
                        <th>Qty filled</th>
                        <th>Batch</th>
                        <th style="width: 40px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${this.state.scannedContainers.map((c, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td style="font-weight: 500;">${c.name}</td>
                            <td>${c.type || '-'}</td>
                            <td>
                                <input type="text" class="ct-input" style="width: 80px; padding: 4px 8px;" value="${this.state.maxFillCapacity}" readonly />
                            </td>
                            <td>${this.state.gasBatch || '-'}</td>
                            <td>
                                <a href="#" style="color: #ef4444;" onclick="window.fillingApp.removeScan(${idx}); return false;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupAwesomplete() {
        let dnControl = frappe.ui.form.make_control({
            df: {
                fieldtype: 'Link',
                options: 'Delivery Note',
                fieldname: 'delivery_note',
                label: 'Delivery Note (submitted)',
                only_input: true,
                get_query: function() {
                    return { filters: { docstatus: 1 } };
                }
            },
            parent: this.$wrapper.find('#dn-control-wrapper'),
            render_input: true
        });
        
        let itemControl = frappe.ui.form.make_control({
            df: {
                fieldtype: 'Link',
                options: 'Item',
                fieldname: 'item',
                label: 'Item',
                only_input: true,
                get_query: () => {
                    if (!this.state.dnItems.length) {
                        return { filters: { name: '' } };
                    }

                    return {
                        filters: {
                            name: ['in', this.state.dnItems]
                        }
                    };
                }
            },
            parent: this.$wrapper.find('#item-control-wrapper'),
            render_input: true
        });
        
        dnControl.$input.on('change', () => {
            setTimeout(() => {
                let val = dnControl.get_value();
                if (val !== this.state.selectedDeliveryNote) {
                    this.state.selectedDeliveryNote = val || null;
                    this.state.dnItems = [];
                    this.state.selectedItem = null;
                    this.itemControl.set_value('');

                    if (this.state.selectedDeliveryNote) {
                        this.fetchDeliveryNoteDetails();
                    }
                }
            }, 200);
        });
        
        itemControl.$input.on('change', () => {
            setTimeout(() => {
                let val = itemControl.get_value();
                if(val && val !== this.state.selectedItem) {
                    this.state.selectedItem = val;
                    if(this.state.selectedDeliveryNote) {
                        this.calculateContext();
                    }
                }
            }, 200);
        });
        
        if(this.state.selectedDeliveryNote) {
            dnControl.set_value(this.state.selectedDeliveryNote);
        }
        if(this.state.selectedItem) {
            itemControl.set_value(this.state.selectedItem);
        }
        
        this.dnControl = dnControl;
        this.itemControl = itemControl;
    }

    fetchDeliveryNoteDetails() {
        if(!this.state.selectedDeliveryNote) return;

        let deliveryNote = this.state.selectedDeliveryNote;
        
        frappe.call({
            method: 'container_tracker.container_tracker.doctype.container_filling_entry.container_filling_entry.get_delivery_note_items',
            args: { delivery_note: deliveryNote },
            callback: (r) => {
                if (deliveryNote !== this.state.selectedDeliveryNote) {
                    return;
                }

                this.state.dnItems = r.message || [];
                
                // Clear the item control value if it's no longer in the list
                if(this.state.selectedItem && !this.state.dnItems.includes(this.state.selectedItem)) {
                    this.state.selectedItem = null;
                    if(this.itemControl) this.itemControl.set_value('');
                }
                
                frappe.db.get_value('Delivery Note', this.state.selectedDeliveryNote, 'customer')
                .then(r2 => {
                    if(r2.message) {
                        this.state.customer = r2.message.customer;
                        this.$wrapper.find('#sum-customer').text(this.state.customer);
                    }
                });
                
                frappe.show_alert({message: `Ready! Click Item (Gas) to select from ${this.state.dnItems.length} items.`, indicator: 'green'});
            }
        });
    }

    calculateContext() {
        if(!this.state.selectedDeliveryNote || !this.state.selectedItem) return;
        
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Delivery Note Item',
                filters: { parent: this.state.selectedDeliveryNote, item_code: this.state.selectedItem },
                fields: ['qty']
            },
            callback: (r) => {
                this.state.orderedQty = 0;
                if(r.message && r.message.length > 0) {
                    this.state.orderedQty = r.message.reduce((acc, val) => acc + val.qty, 0);
                }
                
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Container Filling Entry',
                        filters: { delivery_note: this.state.selectedDeliveryNote, item: this.state.selectedItem, docstatus: 1 },
                        fields: ['quantity_posted']
                    },
                    callback: (r2) => {
                        this.state.alreadyFilledQty = 0;
                        if(r2.message) {
                            this.state.alreadyFilledQty = r2.message.reduce((acc, val) => acc + val.quantity_posted, 0);
                        }
                        
                        this.state.pendingQty = this.state.orderedQty - this.state.alreadyFilledQty;
                        
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Container Types',
                                filters: { default_gas_item: this.state.selectedItem },
                                fields: ['name', 'fill_capacity', 'capacity_uom']
                            },
                            callback: (r3) => {
                                if(r3.message && r3.message.length > 0) {
                                    this.state.containerType = r3.message[0].name;
                                    this.state.maxFillCapacity = r3.message[0].fill_capacity || 0;
                                    this.state.capacityUOM = r3.message[0].capacity_uom || '';
                                    
                                    this.fetchQuickPicks();
                                } else {
                                    this.state.containerType = '';
                                    this.state.maxFillCapacity = 0;
                                    frappe.show_alert({message: `No Container Type configured for item ${this.state.selectedItem}`, indicator: 'orange'});
                                    this.renderScannerView();
                                }
                            }
                        });
                    }
                });
            }
        });
    }

    fetchQuickPicks() {
        if(!this.state.selectedItem) return;
        
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Containers',
                filters: {
                    status: 'Available'
                },
                fields: ['name', 'type'],
                limit_page_length: 10
            },
            callback: (r) => {
                this.state.quickPicks = r.message || [];
                this.renderScannerView(); 
            }
        });
    }

    handleScanInput() {
        let val = this.$wrapper.find('#inp-scan').val().trim();
        if (!val) return;
        this.processScan(val);
    }

    processScan(containerId) {
        if (!this.state.selectedItem || this.state.maxFillCapacity === 0) {
            frappe.show_alert({message: 'Please select an item and ensure it has a configured capacity.', indicator: 'orange'});
            this.$wrapper.find('#inp-scan').val('').focus();
            return;
        }

        if(this.state.scannedContainers.find(c => c.name === containerId)) {
            frappe.show_alert({message: `Container ${containerId} is already in the list`, indicator: 'orange'});
            this.$wrapper.find('#inp-scan').val('').focus();
            return;
        }

        let proposedQty = (this.state.scannedContainers.length + 1) * this.state.maxFillCapacity;
        if (proposedQty > this.state.pendingQty) {
            frappe.show_alert({message: `Cannot add container! This will exceed the pending order quantity of ${this.state.pendingQty} ${this.state.capacityUOM}`, indicator: 'red'});
            this.$wrapper.find('#inp-scan').val('').focus();
            return;
        }

        frappe.call({
            method: 'frappe.client.get',
            args: { doctype: 'Containers', name: containerId },
            callback: (r) => {
                if (r.message) {
                    let c = r.message;
                    if (c.status !== 'Available') {
                        frappe.show_alert({message: `Container ${c.name} is not Available (Current status: ${c.status})`, indicator: 'red'});
                    } else {
                        this.state.scannedContainers.push(c);
                        this.state.quickPicks = this.state.quickPicks.filter(qp => qp.name !== c.name);
                        this.renderScannerView();
                    }
                } else {
                    frappe.show_alert({message: `Container ${containerId} not found`, indicator: 'red'});
                }
                this.$wrapper.find('#inp-scan').val('').focus();
            }
        });
    }

    removeScan(idx) {
        this.state.scannedContainers.splice(idx, 1)[0];
        this.renderScannerView();
    }

    submitFillingEntry() {
        if (!this.state.selectedDeliveryNote || !this.state.selectedItem) {
            frappe.throw("Please select Delivery Note and Item");
            return;
        }
        if (this.state.scannedContainers.length === 0) {
            frappe.throw("Please scan at least one container");
            return;
        }

        let totalQty = this.state.scannedContainers.length * this.state.maxFillCapacity;

        let items = this.state.scannedContainers.map(c => {
            return {
                container: c.name,
                type: c.type,
                batch: this.state.gasBatch,
                qty_filled: this.state.maxFillCapacity
            };
        });

        frappe.call({
            method: 'frappe.client.insert',
            args: {
                doc: {
                    doctype: 'Container Filling Entry',
                    posting_date: frappe.datetime.get_today(),
                    delivery_note: this.state.selectedDeliveryNote,
                    item: this.state.selectedItem,
                    operator: this.state.operator,
                    containers_filled: items.length,
                    quantity_posted: totalQty,
                    container_filling_items: items
                }
            },
            callback: (r) => {
                if (!r.exc) {
                    frappe.show_alert({message: 'Filling Entry Created!', indicator: 'green'});
                    this.state.scannedContainers = [];
                    this.state.view = 'list';
                    this.fetchData();
                }
            }
        });
    }
}

window.FillingApp = FillingApp;
window.fillingApp = null; 

const originalInit = window.FillingApp.prototype.init;
window.FillingApp.prototype.init = function() {
    window.fillingApp = this;
    originalInit.call(this);
};
