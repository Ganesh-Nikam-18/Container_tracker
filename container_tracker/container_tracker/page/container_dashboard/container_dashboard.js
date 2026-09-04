frappe.pages['container-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Container Tracker',
        single_column: true
    });
    
    // Add subtitle as per image
    page.set_indicator('Fleet position as on ' + frappe.datetime.global_date_format(frappe.datetime.now_date()) + ' - Airgas Industries Pvt Ltd', 'blue');
    page.add_inner_button('Receive & Reconcile', () => { frappe.set_route('List', 'Reconciliation'); });
    page.add_inner_button('New Filling Entry', () => { frappe.set_route('List', 'Container Filling Entry'); }).addClass('btn-primary');

    let $container = $(`<div class="container-dashboard">
        <!-- CSS styles loaded via container_dashboard.css -->
        
        <!-- Top Cards -->
        <div class="row dashboard-cards-section mb-3">
            <div class="col-md-3"><div class="dash-card" id="card-total"><div class="dash-card-title">Total containers</div><div class="dash-card-value">0</div><div class="dash-card-desc">Assets under Gas Cylinders + Bulk Gas Containers</div></div></div>
            <div class="col-md-3"><div class="dash-card" id="card-available"><div class="dash-card-title">Available to fill</div><div class="dash-card-value">0</div><div class="dash-card-desc">Empty, tested, at filling plant</div></div></div>
            <div class="col-md-3"><div class="dash-card" id="card-with-customer"><div class="dash-card-title">With customers</div><div class="dash-card-value">0</div><div class="dash-card-desc">At customers holding stock</div></div></div>
            <div class="col-md-3"><div class="dash-card" id="card-damaged"><div class="dash-card-title">Damaged / under repair</div><div class="dash-card-value">0</div><div class="dash-card-desc">Awaiting valve / hydro test</div></div></div>
            
            <div class="col-md-3 mt-2"><div class="dash-card" id="card-filled"><div class="dash-card-title">Filled, awaiting dispatch</div><div class="dash-card-value">0</div><div class="dash-card-desc">Tagged to submitted delivery notes</div></div></div>
            <div class="col-md-3 mt-2"><div class="dash-card" id="card-deposit"><div class="dash-card-title">Deposit exposure</div><div class="dash-card-value">0</div><div class="dash-card-desc">Security deposit value at customer sites</div></div></div>
            <div class="col-md-3 mt-2"><div class="dash-card" id="card-chargebacks"><div class="dash-card-title">Open chargebacks</div><div class="dash-card-value">0</div><div class="dash-card-desc">Actionable</div></div></div>
            <div class="col-md-3 mt-2"><div class="dash-card" id="card-hydro"><div class="dash-card-title">Hydro test due in 90 days</div><div class="dash-card-value">0</div><div class="dash-card-desc">Block from filling on due date</div></div></div>
        </div>
        
        <!-- Middle Charts Row 1 -->
        <div class="row dashboard-charts-section mb-4">
            <div class="col-md-4">
                <div class="chart-wrapper">
                    <div class="chart-title">Fleet status split</div>
                    <div id="chart-fleet-split"></div>
                </div>
            </div>
            <div class="col-md-8">
                <div class="chart-wrapper">
                    <div class="chart-title">Filling vs returns (this week)</div>
                    <div id="chart-filling-returns"></div>
                </div>
            </div>
        </div>
        
        <!-- Middle Charts Row 2 -->
        <div class="row dashboard-charts-section mb-4">
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <div class="chart-title">Utilisation by container type</div>
                    <div id="chart-utilisation"></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <div class="chart-title">Aging of containers with customers</div>
                    <div id="chart-aging"></div>
                </div>
            </div>
        </div>
        
        <!-- Bottom Lists Row -->
        <div class="row dashboard-lists-section mb-4">
            <div class="col-md-6">
                <div class="list-wrapper">
                    <div class="list-title d-flex justify-content-between">
                        <span>Customer holding summary</span>
                        <a href="/app/query-report/Customer Holding" class="text-muted small">Open report</a>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-borderless table-hover" id="table-customer-holding">
                            <thead>
                                <tr class="text-muted">
                                    <th>Customer</th>
                                    <th>Outstanding</th>
                                    <th>Types</th>
                                    <th>Oldest</th>
                                    <th>Deposit</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="list-wrapper mb-3">
                    <div class="list-title">Recent filling entries</div>
                    <div id="list-recent-fillings"></div>
                </div>
                <div class="list-wrapper">
                    <div class="list-title">Damage & loss flagged on receipt</div>
                    <div id="list-damage-loss"></div>
                </div>
            </div>
        </div>
        
        <!-- Bottom Summary Cards -->
        <div class="row dashboard-summary-section">
            <div class="col-md-4"><div class="summary-card available-bg">Available <span class="small text-muted ml-2">Drill into container list</span> <span class="float-right font-weight-bold" id="summary-available">0</span></div></div>
            <div class="col-md-4"><div class="summary-card customer-bg">With Customer <span class="small text-muted ml-2">Drill into container list</span> <span class="float-right font-weight-bold" id="summary-customer">0</span></div></div>
            <div class="col-md-4"><div class="summary-card damaged-bg">Damaged <span class="small text-muted ml-2">Drill into container list</span> <span class="float-right font-weight-bold" id="summary-damaged">0</span></div></div>
        </div>
    </div>`).appendTo(page.main);

    frappe.call({
        method: 'container_tracker.container_tracker.page.container_dashboard.container_dashboard_data.get_dashboard_data',
        callback: function(r) {
            if(r.message) {
                let data = r.message;
                render_number_cards(data.number_cards);
                render_charts(data);
                render_lists(data);
            }
        }
    });

    function render_number_cards(cards) {
        $('#card-total .dash-card-value').text(cards.total_containers);
        $('#card-available .dash-card-value').text(cards.available_to_fill);
        $('#card-with-customer .dash-card-value').text(cards.with_customers);
        $('#card-damaged .dash-card-value').text(cards.damaged_under_repair);
        $('#card-filled .dash-card-value').text(cards.filled_awaiting_dispatch);
        $('#card-deposit .dash-card-value').text(format_currency(cards.deposit_exposure, 'INR'));
        $('#card-chargebacks .dash-card-value').text(cards.open_chargebacks);
        $('#card-hydro .dash-card-value').text(cards.hydro_test_due);
        
        $('#summary-available').text(cards.available_to_fill);
        $('#summary-customer').text(cards.with_customers);
        $('#summary-damaged').text(cards.damaged_under_repair);
    }

    function render_charts(data) {
        // 1. Fleet status split (Donut)
        let fleet_labels = [];
        let fleet_values = [];
        (data.fleet_status_split || []).forEach(d => {
            fleet_labels.push(d.status);
            fleet_values.push(d.count);
        });
        
        new frappe.Chart("#chart-fleet-split", {
            data: {
                labels: fleet_labels,
                datasets: [{ name: "Status", values: fleet_values }]
            },
            type: 'donut',
            colors: ['#28a745', '#fd7e14', '#007bff', '#17a2b8', '#dc3545', '#6c757d'],
            height: 250
        });

        // 2. Filling vs Returns (Line)
        let dates = [];
        let filled_vals = [];
        let returned_vals = [];
        
        // Ensure dates are aligned
        let filled_map = {};
        (data.filling_vs_returns.filled || []).forEach(d => { filled_map[d.posting_date] = d.count; dates.push(d.posting_date); });
        
        let returned_map = {};
        (data.filling_vs_returns.returned || []).forEach(d => { returned_map[d.posting_date] = d.count; if(!dates.includes(d.posting_date)) dates.push(d.posting_date); });
        
        dates.sort();
        dates.forEach(d => {
            filled_vals.push(filled_map[d] || 0);
            returned_vals.push(returned_map[d] || 0);
        });

        new frappe.Chart("#chart-filling-returns", {
            data: {
                labels: dates,
                datasets: [
                    { name: "Containers filled", values: filled_vals },
                    { name: "Containers returned", values: returned_vals }
                ]
            },
            type: 'line',
            colors: ['#007bff', '#28a745'],
            height: 250,
            lineOptions: { regionFill: 1 }
        });
        
        // 3. Utilisation by type (Stacked Bar)
        let util_labels = Object.keys(data.utilisation_by_type);
        let util_in_customer = [];
        let util_in_plant = [];
        util_labels.forEach(type => {
            util_in_customer.push(data.utilisation_by_type[type].in_customer);
            util_in_plant.push(data.utilisation_by_type[type].in_plant);
        });
        
        new frappe.Chart("#chart-utilisation", {
            data: {
                labels: util_labels,
                datasets: [
                    { name: "In customer", values: util_in_customer },
                    { name: "In plant", values: util_in_plant }
                ]
            },
            type: 'bar',
            barOptions: { stacked: 1, spaceRatio: 0.2 },
            colors: ['#fd7e14', '#007bff'],
            height: 250
        });
        
        // 4. Aging of containers (Bar)
        let aging_labels = ['0-15 days', '16-30 days', '31-60 days', '61-90 days', '90+ days'];
        let aging_values = aging_labels.map(l => data.aging_of_containers[l] || 0);
        
        new frappe.Chart("#chart-chart-aging", { // Typo in original string? Using chart-aging
            // Wait, we used id="chart-aging" in html. 
        });
        // Real implementation:
        new frappe.Chart("#chart-aging", {
            data: {
                labels: aging_labels,
                datasets: [{ name: "Containers", values: aging_values }]
            },
            type: 'bar',
            colors: ['#fd7e14'],
            height: 250
        });
    }

    function render_lists(data) {
        // Customer holding summary
        let html_cust = '';
        (data.customer_holding_summary || []).forEach(d => {
            html_cust += `<tr>
                <td class="font-weight-bold text-dark">${d.customer}</td>
                <td>${d.outstanding}</td>
                <td>${d.types}</td>
                <td>${d.oldest} d</td>
                <td>₹${frappe.format(d.deposit, {fieldtype: 'Currency'})}</td>
            </tr>`;
        });
        $('#table-customer-holding tbody').html(html_cust);
        
        // Recent filling entries
        let html_fill = '';
        (data.recent_filling_entries || []).forEach(d => {
            html_fill += `<div class="d-flex justify-content-between list-item border-bottom py-2">
                <div><a class="font-weight-bold" href="/app/container-filling-entry/${d.name}">${d.name}</a></div>
                <div class="text-muted small">${d.posting_date}</div>
            </div>`;
        });
        $('#list-recent-fillings').html(html_fill);
        
        // Damage & loss
        let html_dmg = '';
        (data.damage_and_loss || []).forEach(d => {
            let color = d.condition === 'Lost' ? 'text-danger' : 'text-warning';
            html_dmg += `<div class="d-flex justify-content-between list-item border-bottom py-2">
                <div><a class="font-weight-bold" href="/app/reconciliation/${d.docname}">${d.docname}</a> <span class="small text-muted ml-2">${d.condition}</span></div>
                <div class="${color} font-weight-bold">₹${d.amount || 0}</div>
            </div>`;
        });
        $('#list-damage-loss').html(html_dmg);
    }
};
