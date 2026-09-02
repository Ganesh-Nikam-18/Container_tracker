frappe.pages['asset-setup'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Asset Setup',
        single_column: true
    });
	
    $(wrapper).closest('.layout-main-section').css({
        'max-width': '100%',
        'padding': '0 30px'
    });

    page.set_title_sub('Customisation on the ERPNext Asset Category and Asset doctypes');

    // Create the layout
    let layout = `
        <div class="row" style="margin-top: 15px;">
            <div class="col-md-12">
                <div class="frappe-card" style="border: 1px solid var(--border-color, #d1d8dd); border-radius: 4px; background-color: var(--card-bg, #fff); padding: 15px;">
                    <h5 style="margin-bottom: 15px; font-weight: 600;">Asset categories</h5>
                    <div class="table-responsive">
                        <table class="table" style="border-bottom: 1px solid var(--border-color, #d1d8dd);">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color, #d1d8dd);">
                                    <th class="text-muted font-weight-normal" style="border: none;">Asset category</th>
                                    <th class="text-muted font-weight-normal" style="border: none;">Tracked container</th>
                                    <th class="text-muted font-weight-normal" style="border: none;">Default container type</th>
                                    <th class="text-muted font-weight-normal" style="border: none;">Naming series</th>
                                    <th class="text-muted font-weight-normal text-center" style="border: none;">Linked containers</th>
                                    <th style="border: none;"></th>
                                </tr>
                            </thead>
                            <tbody id="asset-category-body">
                                <tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    $(page.body).html(layout);

    function load_data() {
        frappe.call({
            method: 'container_tracker.container_tracker.page.asset_setup.asset_setup.get_asset_categories',
            callback: function (r) {
                if (r.message) {
                    render_table(r.message);
                }
            }
        });
    }

    function render_table(categories) {
        let tbody = '';

        categories.forEach(cat => {
            let is_enabled = cat.is_tracked_container_or_cylinder == 1;

            let status_html = is_enabled
                ? `<span class="badge badge-success" style="background-color: var(--bg-green-100, #e8f5e9); color: var(--green-700, #2e7d32); border: 1px solid var(--green-200, #c8e6c9);">Enabled</span>`
                : `<span class="badge badge-secondary" style="background-color: var(--bg-gray-100, #f8f9fa); color: var(--text-muted, #6c757d); border: 1px solid var(--border-color, #dee2e6);">Disabled</span>`;

            let default_type = cat.custom_default_container_type || '—';
            let naming_series = cat.custom_naming_series || '—';

            let btn_text = is_enabled ? 'Disable' : 'Enable';

            tbody += `
                <tr style="border-bottom: 1px solid var(--border-color, #d1d8dd);">
                    <td style="font-weight: 500; vertical-align: middle; border: none; color: var(--text-color);">${cat.name}</td>
                    <td style="vertical-align: middle; border: none;">${status_html}</td>
                    <td style="vertical-align: middle; border: none;">${default_type}</td>
                    <td style="vertical-align: middle; border: none;">${naming_series}</td>
                    <td class="text-center" style="vertical-align: middle; border: none;">${cat.linked_containers}</td>
                    <td class="text-right" style="vertical-align: middle; border: none;">
                        <button class="btn btn-xs btn-default btn-toggle" data-name="${cat.name}" data-val="${is_enabled ? 0 : 1}">
                            ${btn_text}
                        </button>
                    </td>
                </tr>
            `;
        });

        page.body.find('#asset-category-body').html(tbody);

        // Attach handlers
        page.body.find('.btn-toggle').on('click', function () {
            let btn = $(this);
            let name = btn.attr('data-name');
            let val = parseInt(btn.attr('data-val'));

            frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: 'Asset Category',
                    name: name,
                    fieldname: 'is_tracked_container_or_cylinder',
                    value: val
                },
                callback: function (r) {
                    if (!r.exc) {
                        frappe.show_alert({ message: __('Saved'), indicator: 'green' });
                        load_data();
                    }
                }
            });
        });
    }

    load_data();
}
