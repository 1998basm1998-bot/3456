document.addEventListener('DOMContentLoaded', () => {

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('fin-date').value = today;

    let records = JSON.parse(localStorage.getItem('systemRecords')) || [];
    let financials = JSON.parse(localStorage.getItem('financialRecords')) || [];

    // دالة مساعدة: تنسيق الأرقام بفواصل - أرقام إنجليزية
    function fmt(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('en-US');
    }

    // قراءة قيمة حقل نصي يحتوي على فواصل
    function parseVal(input) {
        return parseFloat((input.value || '').replace(/,/g, '')) || 0;
    }

    // تنسيق حقل نصي بفواصل أثناء الكتابة
    function attachCommaFormat(input) {
        input.addEventListener('input', function () {
            const raw = this.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
            if (raw === '' || raw === '.') { this.value = raw; return; }
            const parts = raw.split('.');
            parts[0] = Number(parts[0]).toLocaleString('en-US');
            const pos = this.selectionStart;
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
        if (targetId === 'tab-warehouse') updateWarehouseView();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.getAttribute('data-target'));
        });
    });

    // --- الحسابات التلقائية ---
    const qtyInput           = document.getElementById('quantity');
    const purchaseInput      = document.getElementById('purchase-price');
    const sellingInput       = document.getElementById('selling-price');
    const amountReceivedInput= document.getElementById('amount-received');
    const totalSaleDisplay   = document.getElementById('total-sale-display');
    const netProfitDisplay   = document.getElementById('net-profit-display');
    const remainingDebtDisplay=document.getElementById('remaining-debt-display');

    // ربط تنسيق الفواصل بالحقول النصية
    attachCommaFormat(purchaseInput);
    attachCommaFormat(sellingInput);
    attachCommaFormat(amountReceivedInput);

    function calculateLive() {
        const qty      = parseFloat(qtyInput.value) || 0;
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

    // تعبئة المبلغ الواصل تلقائياً بـ الكمية × سعر الشراء بفواصل
    function autoFillReceived() {
        const qty      = parseFloat(qtyInput.value) || 0;
        const purchase = parseVal(purchaseInput);
        const total    = qty * purchase;
        amountReceivedInput.value = total > 0 ? fmt(Math.round(total)) : '';
        calculateLive();
    }

    qtyInput.addEventListener('input', autoFillReceived);
    purchaseInput.addEventListener('input', () => { autoFillReceived(); saveDefaultPrices(); });
    sellingInput.addEventListener('input',  () => { calculateLive();    saveDefaultPrices(); });
    amountReceivedInput.addEventListener('input', calculateLive);

    // حفظ وتحميل أسعار الشراء والبيع الافتراضية
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

    // --- حفظ أو تعديل حركة المبيعات ---
    const form = document.getElementById('record-form');
    const recordIdInput = document.getElementById('record-id');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentId = recordIdInput.value;
        const inputDate = document.getElementById('date').value;
        const inputCar = document.getElementById('car-info').value.trim();

        // منع تكرار السيارة في نفس اليوم فقط
        const isCarDuplicate = records.some(rec =>
            rec.date === inputDate &&
            rec.carInfo.trim().toLowerCase() === inputCar.toLowerCase() &&
            String(rec.id) !== String(currentId)
        );

        if (isCarDuplicate) {
            alert(`عذراً، السيارة (${inputCar}) مسجلة مسبقاً بتاريخ ${inputDate}.\nيمكن تسجيلها في يوم مختلف.`);
            return;
        }

        const qty      = parseFloat(qtyInput.value) || 0;
        const purchase = parseVal(purchaseInput);
        const selling  = parseVal(sellingInput);
        const received = parseVal(amountReceivedInput);

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
            cashierName: document.getElementById('cashier-name').value.trim(),
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

    // --- عرض الحركات اليومية مع فلتر السائق والشركة ---
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
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="12">لا توجد حركات مطابقة للبحث</td>`;
            transactionsBody.appendChild(tr);
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
                <td>${fmt(rec.amountReceived)}</td>
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

    // --- حركات الصندوق مع التعبئة والتحديثات التلقائية للمواد والمبالغ والأرصدة المتبقية ---
    const finForm = document.getElementById('financial-form');
    const finIdInput = document.getElementById('financial-id');
    const finSubmitBtn = document.getElementById('fin-submit-btn');
    const finEntity = document.getElementById('fin-entity');
    const finType = document.getElementById('fin-type');
    const finAmount = document.getElementById('fin-amount');
    const debtHint = document.getElementById('debt-hint');

    // ملء قائمة مواد الصندوق تلقائياً بناء على الجهة المدخلة من المخزن
    function updateFinMaterials() {
        const entityVal = finEntity.value.trim().toLowerCase();
        const matSel = document.getElementById('fin-material');
        const currentSelected = matSel.value;
        matSel.innerHTML = '<option value="">كل المواد</option>';
        if (!entityVal) return;

        const mats = [...new Set(
            records
                .filter(r =>
                    r.companyName.toLowerCase().includes(entityVal) ||
                    r.driverName.toLowerCase().includes(entityVal)
                )
                .map(r => r.materialType)
                .filter(Boolean)
        )];

        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            // إذا كانت المادة محددة مسبقاً، أو إذا كانت هناك مادة واحدة فقط للشركة يتم اختيارها تلقائياً
            if (m === currentSelected || mats.length === 1) {
                opt.selected = true;
            }
            matSel.appendChild(opt);
        });
    }

    // حساب وعرض رصيد الطنية المتبقي التلقائي للجهة، وتعبئة الحقول بذكاء
    function autoFillDebt(skipInputs = false) {
        const entityVal = finEntity.value.trim().toLowerCase();
        const typeVal = finType.value;
        const matVal = document.getElementById('fin-material').value;

        if (!entityVal) {
            debtHint.style.display = 'none';
            if (!skipInputs) {
                document.getElementById('fin-tonnage').value = '';
                document.getElementById('fin-amount').value = '';
            }
            return;
        }

        // حساب الرصيد دائماً حتى تتعبأ الحقول بغض النظر عن نوع السند المختار حالياً
        let totalQty = 0;
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal)) {
                if (!matVal || r.materialType === matVal) {
                    totalQty += (r.quantity || 0);
                }
            }
        });

        financials.forEach(f => {
            if (f.entityName.toLowerCase().includes(entityVal)) {
                if (!matVal || f.material === matVal) {
                    if (f.type === 'receipt') {
                        totalQty -= (f.tonnage || 0);
                    }
                }
            }
        });

        // إظهار التلميح فقط في حالة الصرف
        if (typeVal === 'payment') {
            debtHint.style.display = 'block';
            const matText = matVal ? `من مادة (${matVal})` : 'لكل المواد';
            if (totalQty > 0) {
                debtHint.innerHTML = `<i class="fas fa-info-circle"></i> الرصيد المتبقي لهذه الجهة ${matText}: <strong>${fmt(totalQty)} طن</strong>`;
            } else {
                debtHint.innerHTML = `<i class="fas fa-check-circle" style="color:var(--profit-color)"></i> لا يوجد رصيد متبقي لهذه الجهة ${matText}`;
            }
        } else {
            debtHint.style.display = 'none';
        }

        // تعبئة الحقول تلقائياً بالكمية المتبقية إذا لم نكن بوضع التعديل اليدوي
        if (!skipInputs) {
            if (totalQty > 0) {
                document.getElementById('fin-tonnage').value = totalQty;
            } else {
                document.getElementById('fin-tonnage').value = '';
            }
            // حساب المبلغ التلقائي بعد تحديث الكمية
            autoCalculateFinAmount();
        }
    }

    // حساب المبلغ تلقائياً بناءً على الطنية وسعر البيع بالمخزن للجهة المحددة
    function autoCalculateFinAmount() {
        const entityVal = finEntity.value.trim().toLowerCase();
        const tonnageVal = parseFloat(document.getElementById('fin-tonnage').value) || 0;
        const matVal = document.getElementById('fin-material').value;
        
        if (!entityVal || tonnageVal <= 0) {
            document.getElementById('fin-amount').value = '';
            return;
        }

        let sellingPrice = 0;
        const lastRecord = [...records].reverse().find(r =>
            (r.companyName.toLowerCase().includes(entityVal) || r.driverName.toLowerCase().includes(entityVal)) &&
            (!matVal || r.materialType === matVal)
        );

        if (lastRecord) {
            sellingPrice = lastRecord.sellingPrice || 0;
        } else {
            sellingPrice = parseFloat(localStorage.getItem('defaultSellingPrice')) || 0;
        }

        if (sellingPrice > 0) {
            document.getElementById('fin-amount').value = Math.round(tonnageVal * sellingPrice);
        } else {
            document.getElementById('fin-amount').value = '';
        }
    }

    // مستمعات الأحداث للتحديث التلقائي الفوري
    finEntity.addEventListener('input', () => {
        updateFinMaterials();
        autoFillDebt(false);
    });
    
    finType.addEventListener('change', () => autoFillDebt(false));
    
    document.getElementById('fin-material').addEventListener('change', () => autoFillDebt(false));
    
    document.getElementById('fin-tonnage').addEventListener('input', autoCalculateFinAmount);

    finForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = finIdInput.value;
        const data = {
            id: id ? parseInt(id) : Date.now(),
            date: document.getElementById('fin-date').value,
            type: finType.value,
            amount: parseFloat(finAmount.value) || 0,
            tonnage: parseFloat(document.getElementById('fin-tonnage').value) || 0,
            material: document.getElementById('fin-material').value,
            entityName: finEntity.value.trim(),
            notes: document.getElementById('fin-notes').value.trim()
        };

        if (id) {
            const idx = financials.findIndex(f => f.id.toString() === id);
            if (idx > -1) financials[idx] = data;
            alert('✅ تم تعديل السند بنجاح!');
        } else {
            financials.push(data);
            alert('✅ تم حفظ السند بنجاح!');
        }

        localStorage.setItem('financialRecords', JSON.stringify(financials));
        finForm.reset();
        finIdInput.value = '';
        document.getElementById('fin-tonnage').value = '';
        document.getElementById('fin-material').innerHTML = '<option value="">كل المواد</option>';
        finSubmitBtn.textContent = 'حفظ السند';
        document.getElementById('fin-date').value = today;
        debtHint.style.display = 'none';
        renderFinancials();
    });

    // عرض سجل الصندوق مع الأيقونات والمواد والكميات الطنية المميزة
    function renderFinancials() {
        const body = document.getElementById('financial-body');
        body.innerHTML = '';

        if (financials.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="8">لا توجد سندات مسجلة</td>`;
            body.appendChild(tr);
            return;
        }

        [...financials].sort((a, b) => b.id - a.id).forEach(f => {
            const tr = document.createElement('tr');
            const isReceipt = f.type === 'receipt';
            const typeHTML = isReceipt
                ? `<span class="icon-receipt"><i class="fas fa-arrow-circle-down"></i></span><span style="color:#00e676; font-weight:bold;">قبض</span>`
                : `<span class="icon-payment"><i class="fas fa-arrow-circle-up"></i></span><span style="color:#ff5252; font-weight:bold;">صرف</span>`;

            tr.innerHTML = `
                <td>${f.date}</td>
                <td>${typeHTML}</td>
                <td>${f.entityName}</td>
                <td>${f.material || '-'}</td>
                <td style="font-weight:bold;">${f.tonnage ? fmt(f.tonnage) : '-'}</td>
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
                finType.value = rec.type;
                finEntity.value = rec.entityName;
                updateFinMaterials();
                document.getElementById('fin-material').value = rec.material || '';
                
                // جلب الملاحظة التوضيحية للديون دون الكتابة فوق القيم التي نريد تعديلها
                autoFillDebt(true);
                
                // إرجاع القيم الأصلية للسند في الحقول ليتم تعديلها
                document.getElementById('fin-tonnage').value = rec.tonnage || '';
                finAmount.value = rec.amount || '';
                document.getElementById('fin-notes').value = rec.notes;
                
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

    // --- ملء قائمة المواد تلقائياً عند كتابة اسم الجهة مع التوليد التلقائي الفوري للكشف ---
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
                .filter(r =>
                    r.companyName.toLowerCase().includes(entity) ||
                    r.driverName.toLowerCase().includes(entity)
                )
                .map(r => r.materialType)
                .filter(Boolean)
        )];

        mats.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            matSel.appendChild(opt);
        });

        document.getElementById('btn-generate-stmt').click();
    });

    document.getElementById('stmt-from').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-to').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());
    document.getElementById('stmt-material').addEventListener('change', () => document.getElementById('btn-generate-stmt').click());

    // --- كشف الحساب التفصيلي الكامل المبني على سعر البيع والرصيد المتبقي للمواد ---
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

        // مبيعات الجهة المحسوبة على أساس سعر البيع
        records.forEach(r => {
            if (r.companyName.toLowerCase().includes(entity) || r.driverName.toLowerCase().includes(entity)) {
                if ((!from || r.date >= from) && (!to || r.date <= to)) {
                    if (matFilter !== 'all' && r.materialType !== matFilter) return;
                    stmtRecords.push({
                        date: r.date,
                        type: 'فاتورة مبيعات',
                        person: r.driverName,
                        car: r.carInfo,
                        material: r.materialType,
                        quantity: r.quantity,
                        unit: r.unitType,
                        purchasePrice: r.sellingPrice,
                        debit: r.quantity * r.sellingPrice,
                        credit: r.amountReceived
                    });
                }
            }
        });

        // دمج مستندات وسندات الصندوق المالية والكمية مع تصفية المادة إن وجدت
        financials.forEach(f => {
            if (f.entityName.toLowerCase().includes(entity)) {
                if (matFilter !== 'all' && f.material !== matFilter) return;
                if ((!from || f.date >= from) && (!to || f.date <= to)) {
                    const isReceipt = f.type === 'receipt';
                    stmtRecords.push({
                        date: f.date,
                        type: isReceipt ? '✅ سند قبض' : '🔴 سند صرف',
                        person: f.entityName,
                        car: '-',
                        material: f.material ? f.material : (f.notes || '-'),
                        quantity: f.tonnage ? f.tonnage : '-',
                        unit: f.tonnage ? 'طنية' : '-',
                        purchasePrice: '-',
                        debit: isReceipt ? 0 : f.amount,
                        credit: isReceipt ? f.amount : 0
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
            const tr = document.createElement('tr');
            tr.className = 'empty-row';
            tr.innerHTML = `<td colspan="10">لا توجد حركات لهذه الجهة في الفترة المحددة</td>`;
            stmtBody.appendChild(tr);
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
                    <td>${row.quantity !== '-' ? fmt(row.quantity) : '-'}</td>
                    <td>${row.unit}</td>
                    <td>${row.purchasePrice !== '-' ? fmt(row.purchasePrice) : '-'}</td>
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

    // --- الإحصاء مع فلتر السائق والجدول التفصيلي ---
    const filterCompanySelect = document.getElementById('filter-company');
    const filterDriverInput = document.getElementById('filter-driver');

    function updateDashboard() {
        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))];
        const currentSelection = filterCompanySelect.value;
        filterCompanySelect.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            filterCompanySelect.appendChild(option);
        });
        filterCompanySelect.value = currentSelection || 'all';
        calculateDashboardStats();
    }

    function calculateDashboardStats() {
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

        // تجميع السجلات حسب الشركة والمادة لخصم المدفوع بدقة (نسبة وتناسب)
        const groups = {};
        filteredRecords.forEach(rec => {
            const key = rec.companyName + '|' + (rec.materialType || '');
            if (!groups[key]) {
                groups[key] = {
                    qty: 0,
                    profit: 0,
                    debt: 0,
                    sales: 0,
                    purchases: 0,
                    companyName: rec.companyName,
                    materialType: (rec.materialType || '')
                };
            }
            groups[key].qty += rec.quantity;
            groups[key].profit += rec.netProfit;
            groups[key].debt += rec.remainingDebt;
            groups[key].sales += (rec.quantity * rec.sellingPrice) || 0;
            groups[key].purchases += (rec.quantity * rec.purchasePrice) || 0;
        });

        Object.values(groups).forEach(g => {
            // حساب الطنية المقبوضة (التي تم سدادها) لهذه الشركة والمادة
            let usedQty = 0;
            financials.forEach(f => {
                if (f.type === 'receipt') {
                    const eName = (f.entityName || '').toLowerCase();
                    const cName = (g.companyName || '').toLowerCase();
                    const matchComp = eName.includes(cName) || cName.includes(eName);
                    
                    let matchDrv = true;
                    if (driverFilter) {
                        matchDrv = eName.includes(driverFilter);
                    }
                    
                    const matchMat = f.material ? (f.material === g.materialType) : true;

                    if (matchComp && matchDrv && matchMat) {
                        usedQty += (parseFloat(f.tonnage) || 0);
                    }
                }
            });

            const originalQty = g.qty;
            let currentQty = originalQty - usedQty;
            if (currentQty < 0) currentQty = 0;

            let ratio = 1;
            if (originalQty > 0) {
                ratio = currentQty / originalQty;
            } else {
                ratio = 0;
            }

            finalTotalQty += currentQty;
            finalTotalProfit += Math.round(g.profit * ratio);
            finalTotalDebt += Math.round(g.debt * ratio);
            finalTotalSales += Math.round(g.sales * ratio);
            finalTotalPurchases += Math.round(g.purchases * ratio);
        });

        document.getElementById('stat-total-qty').textContent = fmt(finalTotalQty);
        document.getElementById('stat-total-profit').textContent = fmt(finalTotalProfit);
        document.getElementById('stat-total-debt').textContent = fmt(finalTotalDebt);
        
        let salesBox = document.getElementById('stat-total-sales');
        if (salesBox) salesBox.textContent = fmt(finalTotalSales);
        
        let purchasesBox = document.getElementById('stat-total-purchases');
        if (purchasesBox) purchasesBox.textContent = fmt(finalTotalPurchases);

        // عرض الجدول التفصيلي إذا كانت هناك فلترة
        const detailSection = document.getElementById('detail-section');
        const detailBody = document.getElementById('detail-body');
        detailBody.innerHTML = '';

        if (selectedCompany !== 'all' || driverFilter) {
            detailSection.style.display = 'block';

            if (filteredRecords.length === 0) {
                const tr = document.createElement('tr');
                tr.className = 'empty-row';
                tr.innerHTML = `<td colspan="11">لا توجد حركات مطابقة</td>`;
                detailBody.appendChild(tr);
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
    // نظام المخزن — مبني على بيانات السيارات والموردين
    // ============================================================
    function updateWarehouseView() {
        const compSel = document.getElementById('wh-filter-company');
        const matSel  = document.getElementById('wh-filter-mat-view');

        // حفظ القيم الحالية قبل إعادة البناء
        const prevComp = compSel.value;
        const prevMat  = matSel.value;

        // ملء قائمة الشركات
        const companies = [...new Set(records.map(r => r.companyName).filter(Boolean))].sort();
        compSel.innerHTML = '<option value="all">الكل</option>';
        companies.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            compSel.appendChild(opt);
        });
        compSel.value = companies.includes(prevComp) ? prevComp : 'all';

        // ملء قائمة المواد
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
            let totalQty   = recs.reduce((s, r) => s + r.quantity, 0);
            let totalPurch = recs.reduce((s, r) => s + r.quantity * r.purchasePrice, 0);
            let totalSale  = recs.reduce((s, r) => s + (r.quantity * r.sellingPrice || 0), 0);
            const unit       = recs[0]?.unitType || '';

            // طرح الكميات التي تم قبضها من الصندوق (سند قبض)
            let usedQty = 0;
            financials.forEach(f => {
                if (f.type === 'receipt' && f.material === mat) {
                    let matchComp = true;
                    if (compVal !== 'all') {
                        const eName = (f.entityName || '').toLowerCase();
                        const cVal = compVal.toLowerCase();
                        matchComp = eName.includes(cVal) || cVal.includes(eName);
                    }
                    if (matchComp) {
                        usedQty += (parseFloat(f.tonnage) || 0);
                    }
                }
            });

            const originalQty = totalQty;
            let currentQty = totalQty - usedQty;
            if (currentQty < 0) currentQty = 0;

            // حساب التكلفة وقيمة البيع بشكل يتناسب مع المتبقي من المادة
            if (originalQty > 0) {
                let ratio = currentQty / originalQty;
                totalPurch = Math.round(totalPurch * ratio);
                totalSale  = Math.round(totalSale * ratio);
            } else {
                totalPurch = 0;
                totalSale  = 0;
            }

            // إخفاء الأيقونة (المربع) بالكامل إذا تم تسديد كمية المادة ولم يتبقَ منها شيء
            if (currentQty <= 0) return;

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
                        <div style="color:#fff; font-weight:bold; font-size:1rem;">${fmt(currentQty)}</div>
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

        if (grid.innerHTML === '') {
            grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">لا توجد مواد متبقية (تم التسديد بالكامل)</p>';
        }
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

    // تهيئة أولية للمخزن
    updateWarehouseView();

});
