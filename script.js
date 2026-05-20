document.addEventListener('DOMContentLoaded', () => {

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('fin-date').value = today;

    let records = JSON.parse(localStorage.getItem('systemRecords')) || [];
    let financials = JSON.parse(localStorage.getItem('financialRecords')) || [];

    // دالة التنسيق للأرقام لضمان ظهور الفواصل والسالب
    function fmt(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('en-US');
    }

    function parseVal(input) {
        const val = input.value || input;
        if(typeof val === 'string') {
            return parseFloat(val.replace(/,/g, '')) || 0;
        }
        return parseFloat(val) || 0;
    }

    // تنسيق حقل نصي بفواصل (يسمح بإدخال السالب أيضاً)
    function attachCommaFormat(input) {
        if(!input) return;
        input.addEventListener('input', function () {
            const raw = this.value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
            if (raw === '' || raw === '.' || raw === '-') { this.value = raw; return; }
            const parts = raw.split('.');
            parts[0] = Number(parts[0]).toLocaleString('en-US');
            this.value = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
        });
    }

    // --- نظام التبويبات ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    function switchTab(targetId) {
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (targetNav) targetNav.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'tab-transactions') renderTransactions();
        if (targetId === 'tab-financial')    renderFinancials();
        if (targetId === 'tab-dashboard')    updateDashboard();
        if (targetId === 'tab-warehouse')    updateWarehouseView();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    // --- الحسابات التلقائية لتبويبة البيانات ---
    const qtyInput           = document.getElementById('quantity');
    const purchaseInput      = document.getElementById('purchase-price');
    const sellingInput       = document.getElementById('selling-price');
    const amountReceivedInput= document.getElementById('amount-received');
    const totalSaleDisplay   = document.getElementById('total-sale-display');
    const netProfitDisplay   = document.getElementById('net-profit-display');
    const remainingDebtDisplay=document.getElementById('remaining-debt-display');

    attachCommaFormat(qtyInput);
    attachCommaFormat(purchaseInput);
    attachCommaFormat(sellingInput);
    attachCommaFormat(amountReceivedInput);
    attachCommaFormat(document.getElementById('fin-amount'));

    function calculateLive() {
        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const selling  = parseVal(sellingInput);
        const received = parseVal(amountReceivedInput);

        const totalSale    = qty * selling;
        const netProfit    = (selling - purchase) * qty;
        const totalPurchase= qty * purchase;
        const remaining    = totalPurchase - received;

        totalSaleDisplay.textContent    = fmt(totalSale);
        netProfitDisplay.textContent    = fmt(netProfit);
        remainingDebtDisplay.textContent= fmt(remaining);
    }

    function autoFillReceived() {
        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const total    = qty * purchase;
        amountReceivedInput.value = total > 0 ? fmt(Math.round(total)) : '';
        calculateLive();
    }

    qtyInput.addEventListener('input', autoFillReceived);
    purchaseInput.addEventListener('input', () => { autoFillReceived(); saveDefaultPrices(); });
    sellingInput.addEventListener('input',  () => { calculateLive();    saveDefaultPrices(); });
    amountReceivedInput.addEventListener('input', calculateLive);

    function saveDefaultPrices() {
        const p = parseVal(purchaseInput);
        const s = parseVal(sellingInput);
        if (p) localStorage.setItem('defaultPurchasePrice', p);
        if (s) localStorage.setItem('defaultSellingPrice', s);
    }

    function loadDefaultPrices() {
        const defPurchase = localStorage.getItem('defaultPurchasePrice');
        const defSelling  = localStorage.getItem('defaultSellingPrice');
        if (defPurchase && !purchaseInput.value) purchaseInput.value = fmt(Number(defPurchase));
        if (defSelling  && !sellingInput.value)  sellingInput.value  = fmt(Number(defSelling));
        calculateLive();
    }

    loadDefaultPrices();

    // --- حفظ أو تعديل الحركة (شاشة البيانات) ---
    const form = document.getElementById('record-form');
    const recordIdInput = document.getElementById('record-id');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentId = recordIdInput.value;
        const inputDate = document.getElementById('date').value;
        const inputCar = document.getElementById('car-info').value.trim();

        const isCarDuplicate = records.some(rec =>
            rec.date === inputDate &&
            rec.carInfo.trim().toLowerCase() === inputCar.toLowerCase() &&
            String(rec.id) !== String(currentId)
        );

        if (isCarDuplicate) {
            alert(`عذراً، السيارة (${inputCar}) مسجلة مسبقاً بتاريخ ${inputDate}.\nيمكن تسجيلها في يوم مختلف.`);
            return;
        }

        const qty      = parseVal(qtyInput);
        const purchase = parseVal(purchaseInput);
        const selling  = parseVal(sellingInput);
        const received = parseVal(amountReceivedInput);
        const cashier  = document.getElementById('cashier-name').value.trim();

        const recordData = {
            id: currentId ? parseInt(currentId) : Date.now(),
            date: inputDate,
            driverName: document.getElementById('driver-name').value.trim(),
            companyName: document.getElementById('company-name').value.trim(),
            carInfo: inputCar,
            materialType: document.getElementById('material-type').value.trim(),
            unitType: document.getElementById('unit-type').value,
            quantity: qty,
            purchasePrice: purchase,
            sellingPrice: selling,
            totalSale: qty * selling,
            netProfit: (selling - purchase) * qty,
            cashierName: cashier || 'بدون صندوق',
            amountReceived: received,
            remainingDebt: (qty * purchase) - received
        };

        if (currentId) {
            const index = records.findIndex(r => String(r.id) === String(currentId));
            if (index !== -1) records[index] = recordData;
            alert('✅ تم تعديل الحركة بنجاح!');
        } else {
            records.push(recordData);
            alert('✅ تم حفظ الحركة بنجاح!');
        }

        localStorage.setItem('systemRecords', JSON.stringify(records));
        resetSalesForm();
    });

    function resetSalesForm() {
        form.reset();
        recordIdInput.value = '';
        submitBtn.textContent = 'حفظ البيانات';
        document.getElementById('date').value = today;
        loadDefaultPrices();
    }

    // --- عرض الحركات اليومية ---
    const transactionsBody = document.getElementById('transactions-body');
    const searchDriver = document.getElementById('search-driver');
    const searchCompany = document.getElementById('search-company');
    const searchDate = document.getElementById('search-date');

    function renderTransactions() {
        transactionsBody.innerHTML = '';
        const driverFilter = searchDriver.value.trim().toLowerCase();
        const companyFilter = searchCompany.value.trim().toLowerCase();
        const dateFilter = searchDate.value;

        const filteredRecords = records.filter(rec => {
            const matchDriver = driverFilter ? rec.driverName.toLowerCase().includes(driverFilter) : true;
            const matchCompany = companyFilter ? rec.companyName.toLowerCase().includes(companyFilter) : true;
            const matchDate = dateFilter ? rec.date === dateFilter : true;
            return matchDriver && matchCompany && matchDate;
        });

        if (filteredRecords.length === 0) {
            transactionsBody.innerHTML = `<tr class="empty-row"><td colspan="13">لا توجد حركات مطابقة للبحث</td></tr>`;
            return;
        }

        filteredRecords.sort((a, b) => b.id - a.id).forEach(rec => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${rec.date}</td>
                <td>${rec.driverName}</td>
                <td>${rec.carInfo}</td>
                <td>${rec.companyName}</td>
                <td>${rec.materialType} (${rec.unitType})</td>
                <td>${fmt(rec.quantity)}</td>
                <td>${fmt(rec.purchasePrice)}</td>
                <td>${fmt(rec.sellingPrice)}</td>
                <td style="color:var(--accent-color); font-weight:bold;">${rec.cashierName}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(rec.amountReceived)}</td>
                <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit edit-sale" data-id="${rec.id}">تعديل</button>
                        <button class="action-btn btn-delete delete-sale" data-id="${rec.id}">حذف</button>
                    </div>
                </td>
            `;
            transactionsBody.appendChild(tr);
        });
    }

    transactionsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = records.find(r => r.id === id);
            if (rec) {
                recordIdInput.value = rec.id;
                document.getElementById('date').value = rec.date;
                document.getElementById('driver-name').value = rec.driverName;
                document.getElementById('company-name').value = rec.companyName;
                document.getElementById('car-info').value = rec.carInfo;
                document.getElementById('material-type').value = rec.materialType;
                document.getElementById('unit-type').value = rec.unitType;
                qtyInput.value             = rec.quantity;
                purchaseInput.value        = fmt(rec.purchasePrice);
                sellingInput.value         = fmt(rec.sellingPrice);
                document.getElementById('cashier-name').value = rec.cashierName;
                amountReceivedInput.value  = fmt(rec.amountReceived);
                submitBtn.textContent = 'تعديل البيانات';
                calculateLive();
                switchTab('tab-add');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('delete-sale')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
                records = records.filter(r => r.id !== id);
                localStorage.setItem('systemRecords', JSON.stringify(records));
                renderTransactions();
            }
        }
    });

    searchDriver.addEventListener('input', renderTransactions);
    searchCompany.addEventListener('input', renderTransactions);
    searchDate.addEventListener('change', renderTransactions);


    // ==========================================================
    // حركات الصندوق (تمويل وسحب العهدة للفورمنية) المبسطة
    // ==========================================================
    const finForm = document.getElementById('financial-form');
    const finIdInput = document.getElementById('financial-id');
    const finSubmitBtn = document.getElementById('fin-submit-btn');

    finForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = finIdInput.value;
        const cashier = document.getElementById('fin-cashier').value.trim();
        
        const data = {
            id: id ? parseInt(id) : Date.now(),
            date: document.getElementById('fin-date').value,
            type: document.getElementById('fin-type').value, 
            cashierName: cashier,
            amount: parseVal(document.getElementById('fin-amount')),
            notes: document.getElementById('fin-notes').value.trim()
        };

        if (id) {
            const idx = financials.findIndex(f => f.id.toString() === id);
            if (idx > -1) financials[idx] = data;
            alert('✅ تم تعديل السند بنجاح!');
        } else {
            financials.push(data);
            alert('✅ تم تسجيل العملية بنجاح!');
        }

        localStorage.setItem('financialRecords', JSON.stringify(financials));
        finForm.reset();
        finIdInput.value = '';
        finSubmitBtn.textContent = 'حفظ العملية';
        document.getElementById('fin-date').value = today;
        renderFinancials();
    });

    function renderFinancials() {
        const body = document.getElementById('financial-body');
        body.innerHTML = '';

        if (financials.length === 0) {
            body.innerHTML = `<tr class="empty-row"><td colspan="6">لا توجد تمويلات مسجلة</td></tr>`;
            return;
        }

        [...financials].sort((a, b) => b.id - a.id).forEach(f => {
            const tr = document.createElement('tr');
            
            // لضمان قراءة السجلات القديمة بشكل صحيح
            const isDeposit = (f.type === 'deposit' || f.type === 'receipt');
            const typeHTML = isDeposit
                ? `<span class="icon-receipt"><i class="fas fa-arrow-circle-down"></i></span><span style="color:#00e676; font-weight:bold;">إيداع (تمويل)</span>`
                : `<span class="icon-payment"><i class="fas fa-arrow-circle-up"></i></span><span style="color:#ff5252; font-weight:bold;">سحب (مصروف)</span>`;

            // ضمان قراءة الاسم القديم إن وُجد
            const fname = f.cashierName || f.fundName || f.entityName || f.boxName || '-';

            tr.innerHTML = `
                <td>${f.date}</td>
                <td>${typeHTML}</td>
                <td style="color:var(--accent-color); font-weight:bold;">${fname}</td>
                <td style="font-weight:bold;">${fmt(f.amount)}</td>
                <td>${f.notes || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn btn-edit fin-edit" data-id="${f.id}">تعديل</button>
                        <button class="action-btn btn-delete fin-delete" data-id="${f.id}">حذف</button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    document.getElementById('financial-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('fin-edit')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const rec = financials.find(f => f.id === id);
            if (rec) {
                finIdInput.value = rec.id;
                document.getElementById('fin-date').value = rec.date;
                
                let t = rec.type;
                if(t === 'receipt') t = 'deposit';
                if(t === 'payment') t = 'withdraw';
                document.getElementById('fin-type').value = t;
                
                document.getElementById('fin-cashier').value = rec.cashierName || rec.fundName || rec.entityName || rec.boxName || '';
                document.getElementById('fin-amount').value = fmt(rec.amount);
                document.getElementById('fin-notes').value = rec.notes || '';
                
                finSubmitBtn.textContent = 'تعديل السند';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else if (e.target.classList.contains('fin-delete')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            if (confirm('هل متأكد من حذف هذا السند نهائياً؟')) {
                financials = financials.filter(f => f.id !== id);
                localStorage.setItem('financialRecords', JSON.stringify(financials));
                renderFinancials();
            }
        }
    });

    // --- كشف الحساب (يقرأ فقط من حركات البيانات دون تداخل) ---
    document.getElementById('stmt-entity').addEventListener('input', function () {
        const entity = this.value.trim().toLowerCase();
        const matSel = document.getElementById('stmt-material');
        matSel.innerHTML = '<option value="all">كل المواد</option>';
        if (!entity) {
            document.getElementById('stmt-result').style.display = 'none';
            return;
        }

        const mats = [...new Set(
            records
                .filter(r => r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity))
                .map(r => r.materialType)
                .filter(Boolean)
        )];

        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            matSel.appendChild(opt);
        });

        document.getElementById('btn-generate-stmt').click();
    });

    document.getElementById('stmt-from').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-to').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-material').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());

    document.getElementById('btn-generate-stmt').addEventListener('click', () => {
        const from = document.getElementById('stmt-from').value;
        const to = document.getElementById('stmt-to').value;
        const entity = document.getElementById('stmt-entity').value.trim().toLowerCase();
        const matFilter = document.getElementById('stmt-material').value;

        if (!entity) {
            document.getElementById('stmt-result').style.display = 'none';
            return;
        }

        let stmtRecords = [];

        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity)) {
                if ((!from || r.date >= from) && (!to || r.date <= to)) {
                    if (matFilter !== 'all' && r.materialType !== matFilter) return;
                    stmtRecords.push({
                        date: r.date,
                        type: 'حركة شراء',
                        person: r.driverName,
                        car: r.carInfo,
                        material: r.materialType,
                        quantity: r.quantity,
                        purchasePrice: r.purchasePrice,
                        debit: r.quantity * r.purchasePrice, // المبلغ المستحق الكلي
                        credit: r.amountReceived // المبلغ الواصل له
                    });
                }
            }
        });

        stmtRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        const stmtBody = document.getElementById('stmt-body');
        stmtBody.innerHTML = '';

        let totalDebit = 0;
        let totalCredit = 0;

        if (stmtRecords.length === 0) {
            stmtBody.innerHTML = `<tr class="empty-row"><td colspan="9">لا توجد حركات لهذه الجهة في الفترة المحددة</td></tr>`;
        } else {
            stmtRecords.forEach(row => {
                totalDebit += row.debit;
                totalCredit += row.credit;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.date}</td>
                    <td style="font-size:0.85rem;">${row.type}</td>
                    <td>${row.person}</td>
                    <td>${row.car}</td>
                    <td>${row.material}</td>
                    <td>${fmt(row.quantity)}</td>
                    <td>${fmt(row.purchasePrice)}</td>
                    <td style="color:#ff5252; font-weight:bold;">${row.debit > 0 ? fmt(row.debit) : '-'}</td>
                    <td style="color:#00e676; font-weight:bold;">${row.credit > 0 ? fmt(row.credit) : '-'}</td>
                `;
                stmtBody.appendChild(tr);
            });
        }

        const finalBalance = totalDebit - totalCredit;
        document.getElementById('stmt-final-balance').textContent = fmt(finalBalance);
        document.getElementById('stmt-total-paid').textContent = fmt(totalCredit);
        document.getElementById('stmt-result').style.display = 'block';
    });

    // --- الإحصائيات وأرصدة الصناديق (العُهد) ---
    const filterCompanySelect = document.getElementById('filter-company');
    const filterDriverInput = document.getElementById('filter-driver');

    function updateDashboard() {
        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))];
        const currentSelection = filterCompanySelect.value;
        filterCompanySelect.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company; option.textContent = company;
            filterCompanySelect.appendChild(option);
        });
        filterCompanySelect.value = currentSelection || 'all';
        
        calculateDashboardStats();
    }

    function calculateDashboardStats() {
        
        // --- 1. حساب وعرض أرصدة الصناديق (العهد النقدية للفورمنية) ---
        let funds = {};
        
        // أ) أموال تم إيداعها أو سحبها مباشرة من شاشة الصندوق
        financials.forEach(f => {
            let name = (f.cashierName || f.fundName || f.entityName || f.boxName || '').trim();
            if (!name) return;
            if (!funds[name]) funds[name] = 0;
            
            const isDeposit = (f.type === 'deposit' || f.type === 'receipt');
            if (isDeposit) {
                funds[name] += (parseFloat(f.amount) || 0);
            } else {
                funds[name] -= (parseFloat(f.amount) || 0);
            }
        });

        // ب) أموال دفعها الفورمن تلقائياً للسواق أثناء تسجيل المشتريات (شاشة البيانات)
        records.forEach(r => {
            let name = (r.cashierName || '').trim();
            if (name && r.amountReceived) {
                if (!funds[name]) funds[name] = 0;
                funds[name] -= (parseFloat(r.amountReceived) || 0);
            }
        });

        const fundGrid = document.getElementById('fund-balances-grid');
        fundGrid.innerHTML = '';
        
        const fNames = Object.keys(funds);
        if (fNames.length === 0) {
            fundGrid.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1;">لا توجد عُهد مالية مسجلة حالياً.</p>';
        } else {
            fNames.forEach(name => {
                const bal = funds[name];
                const isNegative = bal < 0; // الرصيد بالسالب كما طلب العميل
                const box = document.createElement('div');
                
                // تلوين حسب الرصيد
                box.className = `stat-box glass-panel-inner ${isNegative ? 'warning' : ''}`;
                if (!isNegative && bal > 0) box.style.borderColor = 'var(--profit-color)';
                else if (isNegative) box.style.borderColor = 'var(--danger-color)';

                const colorStyle = isNegative ? 'color: var(--danger-color);' : (bal > 0 ? 'color: var(--profit-color);' : 'color: white;');
                
                box.innerHTML = `
                    <h3 style="${isNegative ? 'color: var(--danger-color);' : ''}"><i class="fas fa-wallet"></i> صندوق: ${name}</h3>
                    <p style="${colorStyle} font-weight:bold; font-size:1.5rem;" dir="ltr">${fmt(bal)}</p>
                    ${isNegative ? '<small style="color:var(--danger-color); display:block; margin-top:5px; font-size:0.85rem; font-weight:bold;">(تم تجاوز العهدة)</small>' : ''}
                `;
                fundGrid.appendChild(box);
            });
        }

        // --- 2. إحصائيات العمل والمخزن ---
        const selectedCompany = filterCompanySelect.value;
        const driverFilter = filterDriverInput.value.trim().toLowerCase();

        let filteredRecords = records;

        if (selectedCompany !== 'all') {
            filteredRecords = filteredRecords.filter(r => r.companyName === selectedCompany);
        }
        if (driverFilter) {
            filteredRecords = filteredRecords.filter(r => r.driverName.toLowerCase().includes(driverFilter));
        }

        let finalTotalQty = 0;
        let finalTotalProfit = 0;
        let finalTotalDebt = 0;
        let finalTotalSales = 0;
        let finalTotalPurchases = 0;

        filteredRecords.forEach(rec => {
            finalTotalQty += (rec.quantity || 0);
            finalTotalProfit += (rec.netProfit || 0);
            finalTotalDebt += (rec.remainingDebt || 0);
            finalTotalSales += ((rec.quantity || 0) * (rec.sellingPrice || 0));
            finalTotalPurchases += ((rec.quantity || 0) * (rec.purchasePrice || 0));
        });

        document.getElementById('stat-total-qty').textContent = fmt(finalTotalQty);
        document.getElementById('stat-total-profit').textContent = fmt(finalTotalProfit);
        document.getElementById('stat-total-debt').textContent = fmt(finalTotalDebt);
        
        let salesBox = document.getElementById('stat-total-sales');
        if (salesBox) salesBox.textContent = fmt(finalTotalSales);
        
        let purchasesBox = document.getElementById('stat-total-purchases');
        if (purchasesBox) purchasesBox.textContent = fmt(finalTotalPurchases);

        // عرض الجدول التفصيلي للفلترة
        const detailSection = document.getElementById('detail-section');
        const detailBody = document.getElementById('detail-body');
        detailBody.innerHTML = '';

        if (selectedCompany !== 'all' || driverFilter) {
            detailSection.style.display = 'block';

            if (filteredRecords.length === 0) {
                detailBody.innerHTML = `<tr class="empty-row"><td colspan="11">لا توجد حركات مطابقة</td></tr>`;
            } else {
                [...filteredRecords].sort((a, b) => b.id - a.id).forEach(rec => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${rec.date}</td>
                        <td>${rec.driverName}</td>
                        <td>${rec.carInfo}</td>
                        <td>${rec.materialType}</td>
                        <td>${fmt(rec.quantity)}</td>
                        <td>${rec.unitType}</td>
                        <td>${fmt(rec.purchasePrice)}</td>
                        <td>${fmt(rec.sellingPrice)}</td>
                        <td>${fmt(rec.amountReceived)}</td>
                        <td style="color:#ff5252; font-weight:bold;">${fmt(rec.remainingDebt)}</td>
                        <td style="color:#00e676; font-weight:bold;">${fmt(rec.netProfit)}</td>
                    `;
                    detailBody.appendChild(tr);
                });
            }
        } else {
            detailSection.style.display = 'none';
        }
    }

    filterCompanySelect.addEventListener('change', calculateDashboardStats);
    filterDriverInput.addEventListener('input', calculateDashboardStats);

    // ============================================================
    // عرض أرصدة المخزن 
    // ============================================================
    function updateWarehouseView() {
        const compSel = document.getElementById('wh-filter-company');
        const matSel  = document.getElementById('wh-filter-mat-view');

        const prevComp = compSel.value;
        const prevMat  = matSel.value;

        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))].sort();
        compSel.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            compSel.appendChild(opt);
        });
        compSel.value = companies.includes(prevComp) ? prevComp : 'all';

        const mats = [...new Set(records.map(r => r.materialType).filter(Boolean))].sort();
        matSel.innerHTML = '<option value="all">كل المواد</option>';
        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            matSel.appendChild(opt);
        });
        matSel.value = mats.includes(prevMat) ? prevMat : 'all';

        renderWhBalance();
        renderWhDetail();
    }

    function renderWhBalance() {
        const grid     = document.getElementById('wh-balance-grid');
        const compVal  = document.getElementById('wh-filter-company').value;
        const matVal   = document.getElementById('wh-filter-mat-view').value;
        grid.innerHTML = '';

        let base = records;
        if (compVal !== 'all') base = base.filter(r => r.companyName === compVal);
        if (matVal  !== 'all') base = base.filter(r => r.materialType === matVal);

        const mats = [...new Set(base.map(r => r.materialType).filter(Boolean))];

        if (mats.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">لا توجد بيانات</p>';
            return;
        }

        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';

        mats.forEach(mat => {
            const recs       = base.filter(r => r.materialType === mat);
            let totalQty   = recs.reduce((s, r) => s + (r.quantity || 0), 0);
            let totalPurch = recs.reduce((s, r) => s + (r.quantity || 0) * (r.purchasePrice || 0), 0);
            let totalSale  = recs.reduce((s, r) => s + ((r.quantity || 0) * (r.sellingPrice || 0)), 0);
            const unit       = recs[0]?.unitType || '';

            if (totalQty <= 0) return;

            const box = document.createElement('div');
            box.className = 'glass-panel-inner wh-balance-box';
            box.style.borderColor = 'var(--accent-color)';
            box.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-weight:bold; font-size:1.05rem;">${mat}</span>
                    <span style="font-size:0.8rem; background:rgba(0,230,118,0.15); color:#00e676; padding:2px 8px; border-radius:12px;">${unit}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">إجمالي الكمية</div>
                        <div style="color:#fff; font-weight:bold; font-size:1rem;">${fmt(totalQty)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">قيمة الشراء</div>
                        <div style="color:#ff5252; font-weight:bold;">${fmt(totalPurch)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:3px;">قيمة البيع</div>
                        <div style="color:#00e676; font-weight:bold;">${fmt(totalSale)}</div>
                    </div>
                </div>
            `;
            grid.appendChild(box);
        });
    }

    function renderWhDetail() {
        const body    = document.getElementById('wh-detail-body');
        const compVal = document.getElementById('wh-filter-company').value;
        const matVal  = document.getElementById('wh-filter-mat-view').value;
        body.innerHTML = '';

        let base = records;
        if (compVal !== 'all') base = base.filter(r => r.companyName === compVal);
        if (matVal  !== 'all') base = base.filter(r => r.materialType === matVal);

        if (base.length === 0) {
            body.innerHTML = `<tr class="empty-row"><td colspan="11">لا توجد حركات مطابقة</td></tr>`;
            return;
        }

        [...base].sort((a, b) => b.id - a.id).forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.date}</td>
                <td>${r.driverName}</td>
                <td>${r.carInfo}</td>
                <td>${r.companyName}</td>
                <td>${r.materialType}</td>
                <td style="font-weight:bold;">${fmt(r.quantity)}</td>
                <td>${r.unitType}</td>
                <td>${fmt(r.purchasePrice)}</td>
                <td>${fmt(r.sellingPrice)}</td>
                <td style="color:#00e676; font-weight:bold;">${fmt(r.amountReceived)}</td>
                <td style="color:#ff5252; font-weight:bold;">${fmt(r.remainingDebt)}</td>
            `;
            body.appendChild(tr);
        });
    }

    document.getElementById('wh-filter-company').addEventListener('change', () => { renderWhBalance(); renderWhDetail(); });
    document.getElementById('wh-filter-mat-view').addEventListener('change', () => { renderWhBalance(); renderWhDetail(); });

    // تشغيل مبدئي
    updateWarehouseView();
});
