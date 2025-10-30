import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, linkWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appController = {
    // --- STATE MANAGEMENT ---
    state: {
        // Monthly
        assets: [],
        owed: [],
        liabilities: [],
        savingsGoal: 0,
        // Fixed Planning
        incomeQ1: 0,
        incomeQ2: 0,
        fixedExpensesQ1: [],
        fixedExpensesQ2: [],
        // System
        user: null,
        isAnonymous: true,
        unsubscribeFromBudgets: null,
        unsubscribeFromConfig: null,
        app: null,
        db: null,
        auth: null,
        budgetsCol: null,
        configDoc: null,
    },

    // --- DOM ELEMENTS ---
    DOMElements: {
        loaderView: document.getElementById('loader-view'),
        loginView: document.getElementById('login-view'),
        appView: document.getElementById('app-view'),
        loginGoogleBtn: document.getElementById('login-google-btn'),
        continueAnonymouslyBtn: document.getElementById('continue-anonymously-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        loginForAnonBtn: document.getElementById('login-for-anon-btn'),
        userDisplay: document.getElementById('user-display'),
        authError: document.getElementById('auth-error'),
        
        // Tabs
        tabMonthly: document.getElementById('tab-monthly'),
        tabFixed: document.getElementById('tab-fixed'),
        monthlyBudgetView: document.getElementById('monthly-budget-view'),
        fixedExpensesView: document.getElementById('fixed-expenses-view'),

        // Monthly Budget
        assetsList: document.getElementById('assets-list'),
        owedList: document.getElementById('owed-list'),
        liabilitiesList: document.getElementById('liabilities-list'),
        addAssetBtn: document.getElementById('add-asset'),
        addOwedBtn: document.getElementById('add-owed'),
        addLiabilityBtn: document.getElementById('add-liability'),
        addCreditCardBtn: document.getElementById('add-credit-card'),
        totalAssets: document.getElementById('total-assets'),
        totalLiabilities: document.getElementById('total-liabilities'),
        partialNetWorth: document.getElementById('partial-net-worth'),
        netWorth: document.getElementById('net-worth'),
        monthNameInput: document.getElementById('month-name'),
        saveBudgetBtn: document.getElementById('save-budget'),
        clearFormBtn: document.getElementById('clear-form-btn'),
        savedBudgetsList: document.getElementById('saved-budgets-list'),
        noBudgetsMsg: document.getElementById('no-budgets'),
        savingsGoalInput: document.getElementById('savings-goal'),
        savingsGoalDisplay: document.getElementById('savings-goal-display'),
        savingsProgressBar: document.getElementById('savings-progress-bar'),
        savingsProgressText: document.getElementById('savings-progress-text'),

        // Fixed Expenses (NUEVOS ELEMENTOS)
        summaryTotalIncome: document.getElementById('summary-total-income'),
        summaryTotalExpenses: document.getElementById('summary-total-expenses'),
        summaryMonthlyBalance: document.getElementById('summary-monthly-balance'),
        incomeQ1Input: document.getElementById('income-q1-input'),
        fixedExpensesQ1List: document.getElementById('fixed-expenses-q1-list'),
        addFixedExpenseQ1Btn: document.getElementById('add-fixed-expense-q1-btn'),
        totalExpensesQ1: document.getElementById('total-expenses-q1'),
        incomeQ2Input: document.getElementById('income-q2-input'),
        fixedExpensesQ2List: document.getElementById('fixed-expenses-q2-list'),
        addFixedExpenseQ2Btn: document.getElementById('add-fixed-expense-q2-btn'),
        totalExpensesQ2: document.getElementById('total-expenses-q2'),
        saveFixedDataBtn: document.getElementById('save-fixed-data-btn'),
    },

    // --- INITIALIZATION ---
    async init() {
        this.resetForm();
        this.bindEvents();
        await this.initializeFirebase();
        this.setupPWA();
        this.initializeSortable();
    },

    initializeSortable() {
        const lists = [
            { element: this.DOMElements.assetsList, array: 'assets' },
            { element: this.DOMElements.owedList, array: 'owed' },
            { element: this.DOMElements.liabilitiesList, array: 'liabilities' },
            { element: this.DOMElements.fixedExpensesQ1List, array: 'fixedExpensesQ1' },
            { element: this.DOMElements.fixedExpensesQ2List, array: 'fixedExpensesQ2' },
        ];

        lists.forEach(list => {
            if(list.element) {
                new Sortable(list.element, {
                    handle: '.drag-handle',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onEnd: (evt) => {
                        const { oldIndex, newIndex } = evt;
                        const array = this.state[list.array];
                        if (array) {
                            const [movedItem] = array.splice(oldIndex, 1);
                            array.splice(newIndex, 0, movedItem);
                            this.render(); // Re-render to update indexes and UI
                        }
                    },
                });
            }
        });
    },

    async initializeFirebase() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Error fetching config: ${response.statusText}`);
            }
            const firebaseConfig = await response.json();

            if (firebaseConfig && firebaseConfig.apiKey) {
                this.state.app = initializeApp(firebaseConfig);
                this.state.db = getFirestore(this.state.app);
                this.state.auth = getAuth(this.state.app);
                this.setupAuthObserver();
            } else {
                this.showError("La configuración de Firebase no es válida. Revisa las variables de entorno en Vercel.");
            }
        } catch (error) {
            console.error("No se pudo cargar la configuración de Firebase desde el servidor.", error);
            this.showError("No se pudo conectar con el servidor de configuración.");
        }
    },

    showError(message) {
        this.DOMElements.loaderView.style.display = 'none';
        const loginViewContent = this.DOMElements.loginView.querySelector('.card');
        if (loginViewContent) {
            loginViewContent.innerHTML = `<h1 class="text-2xl font-bold text-white mb-4">Error de Configuración</h1><p class="text-red-400">${message}</p>`;
        }
        this.DOMElements.loginView.style.display = 'flex';
    },

    // --- AUTHENTICATION ---
    setupAuthObserver() {
        onAuthStateChanged(this.state.auth, async (user) => {
            if (this.state.unsubscribeFromBudgets) this.state.unsubscribeFromBudgets();
            if (this.state.unsubscribeFromConfig) this.state.unsubscribeFromConfig();
            this.state.unsubscribeFromBudgets = null;
            this.state.unsubscribeFromConfig = null;

            this.state.user = user;
            this.state.isAnonymous = user ? user.isAnonymous : true;
            
            this.DOMElements.loaderView.style.display = 'none'; // Oculta el cargador
            
            if (user) {
                if (!user.isAnonymous && (localStorage.getItem('anonymousBudgets') || localStorage.getItem('anonymousConfig'))) {
                    await this.dataService.migrateLocalDataToFirestore(user.uid);
                }
                
                this.DOMElements.loginView.style.display = 'none';
                this.DOMElements.appView.style.display = 'block'; // Muestra la app

                if (user.isAnonymous) {
                    this.DOMElements.userDisplay.textContent = 'Sesión Invitada';
                    this.DOMElements.logoutBtn.classList.add('hidden');
                    this.DOMElements.loginForAnonBtn.classList.remove('hidden');
                } else {
                    this.DOMElements.userDisplay.textContent = user.displayName || user.email;
                    this.DOMElements.logoutBtn.classList.remove('hidden');
                    this.DOMElements.loginForAnonBtn.classList.add('hidden');
                    this.state.budgetsCol = collection(this.state.db, `budgets/${user.uid}/items`);
                    this.state.configDoc = doc(this.state.db, `budgets/${user.uid}/config`);
                }
                this.dataService.loadBudgets();
                this.dataService.loadFixedData();
            } else {
                this.DOMElements.appView.style.display = 'none';
                this.DOMElements.loginView.style.display = 'flex'; // Muestra el login
                this.DOMElements.loginForAnonBtn.classList.add('hidden');
                this.DOMElements.authError.classList.add('hidden');
                this.resetForm();
            }
        });
    },

    displayAuthError(error) {
        console.error("Authentication Error:", error);
        let errorMessage = 'Hubo un error al autenticar.';
        if (error.code) {
            switch (error.code) {
                case 'auth/unauthorized-domain':
                    errorMessage = 'Dominio no autorizado. Añade el dominio de Vercel en Firebase.';
                    break;
                case 'auth/credential-already-in-use':
                     errorMessage = 'Esa cuenta de Google ya está en uso. Inicia sesión directamente.';
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage = 'La ventana de inicio de sesión fue cerrada.';
                    break;
                default:
                    errorMessage = 'Error desconocido. Inténtalo de nuevo.';
            }
        }
        this.DOMElements.authError.textContent = errorMessage;
        this.DOMElements.authError.classList.remove('hidden');
    },
    
    // --- DATA SERVICE (Firebase & LocalStorage Logic) ---
    dataService: {
        // Monthly Budget
        async saveBudget(budgetData) {
            const { isAnonymous, user, budgetsCol } = appController.state;
            const monthName = budgetData.monthName;

            if (isAnonymous) {
                try {
                    let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
                    const existingIndex = budgets.findIndex(b => b.monthName === monthName);
                    if (existingIndex > -1) budgets[existingIndex] = budgetData;
                    else budgets.push(budgetData);
                    localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
                    return true;
                } catch (error) { console.error("Error saving to localStorage:", error); return false; }
            } else if (user) {
                try {
                    const budgetDocRef = doc(budgetsCol, monthName.replace(/ /g, '-'));
                    await setDoc(budgetDocRef, budgetData);
                    return true;
                } catch (error) { console.error("Error saving to Firestore:", error); return false; }
            }
            return false;
        },
        async deleteBudget(docId) {
            const { isAnonymous, budgetsCol } = appController.state;
             if (isAnonymous) {
                try {
                    let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
                    const monthName = docId.replace(/-/g, ' ');
                    budgets = budgets.filter(b => b.monthName !== monthName);
                    localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
                    this.loadBudgets(); // Refresh list
                } catch (error) { console.error("Error deleting from localStorage:", error); }
            } else if (budgetsCol) {
                try { await deleteDoc(doc(budgetsCol, docId)); } 
                catch (error) { console.error("Error deleting from Firestore:", error); }
            }
        },
        loadBudgets() {
            const { isAnonymous, budgetsCol } = appController.state;
            if (isAnonymous) {
                const budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
                const docs = budgets.map(b => ({ id: b.monthName.replace(/ /g, '-'), data: () => b }));
                appController.renderSavedBudgets(docs);
            } else if (budgetsCol) {
                appController.state.unsubscribeFromBudgets = onSnapshot(budgetsCol, (snapshot) => {
                    appController.renderSavedBudgets(snapshot.docs);
                }, (error) => {
                    console.error("Error in Firestore snapshot listener:", error);
                    appController.DOMElements.noBudgetsMsg.textContent = "Error al cargar datos. Permisos insuficientes.";
                });
            }
        },
        
        // Fixed Data
        async saveFixedData(data) {
            const { isAnonymous, user, configDoc } = appController.state;
             if (isAnonymous) {
                try {
                    localStorage.setItem('anonymousConfig', JSON.stringify(data));
                    return true;
                } catch (error) { console.error("Error saving config to localStorage:", error); return false; }
            } else if (user) {
                try {
                    await setDoc(configDoc, data, { merge: true });
                    return true;
                } catch (error) { console.error("Error saving config to Firestore:", error); return false; }
            }
            return false;
        },
        loadFixedData() {
            const { isAnonymous, configDoc } = appController.state;
            if (isAnonymous) {
                const data = JSON.parse(localStorage.getItem('anonymousConfig')) || {};
                appController.updateFixedDataUI(data);
            } else if (configDoc) {
                appController.state.unsubscribeFromConfig = onSnapshot(configDoc, (doc) => {
                    appController.updateFixedDataUI(doc.data() || {});
                }, (error) => {
                    console.error("Error loading fixed data:", error);
                });
            }
        },

        // Migration
        async migrateLocalDataToFirestore(newUserId) {
            const localBudgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
            const localConfig = JSON.parse(localStorage.getItem('anonymousConfig')) || null;
            
            const newBudgetsCol = collection(appController.state.db, `budgets/${newUserId}/items`);
            const newConfigDoc = doc(appController.state.db, `budgets/${newUserId}/config`);

            const budgetPromises = localBudgets.map(budget => {
                const docRef = doc(newBudgetsCol, budget.monthName.replace(/ /g, '-'));
                return setDoc(docRef, budget);
            });
            
            const configPromise = localConfig ? setDoc(newConfigDoc, localConfig) : Promise.resolve();

            try {
                await Promise.all([...budgetPromises, configPromise]);
                console.log("Local data successfully migrated to Firestore.");
                localStorage.removeItem('anonymousBudgets');
                localStorage.removeItem('anonymousConfig');
            } catch (error) {
                console.error("Error migrating data:", error);
                alert("Hubo un error al mover tus datos locales a tu cuenta.");
            }
        }
    },
    

    // --- UI & EVENT BINDING ---
    bindEvents() {
        // Tabs
        this.DOMElements.tabMonthly.addEventListener('click', () => this.switchView('monthly-budget-view'));
        this.DOMElements.tabFixed.addEventListener('click', () => this.switchView('fixed-expenses-view'));

        // Monthly Budget
        this.DOMElements.addAssetBtn.addEventListener('click', () => this.handleAddItem('asset'));
        this.DOMElements.addOwedBtn.addEventListener('click', () => this.handleAddItem('owed'));
        this.DOMElements.addLiabilityBtn.addEventListener('click', () => this.handleAddItem('liability-standard'));
        this.DOMElements.addCreditCardBtn.addEventListener('click', () => this.handleAddItem('liability-credit-card'));
        this.DOMElements.saveBudgetBtn.addEventListener('click', this.handleSaveBudget.bind(this));
        this.DOMElements.clearFormBtn.addEventListener('click', this.resetForm.bind(this));
        this.DOMElements.savingsGoalInput.addEventListener('input', (e) => {
            this.state.savingsGoal = Number(e.target.value);
            this.calculateTotals();
        });

        // Fixed Expenses
        this.DOMElements.addFixedExpenseQ1Btn.addEventListener('click', () => this.handleAddItem('fixedExpensesQ1'));
        this.DOMElements.addFixedExpenseQ2Btn.addEventListener('click', () => this.handleAddItem('fixedExpensesQ2'));
        this.DOMElements.incomeQ1Input.addEventListener('input', (e) => {
            this.state.incomeQ1 = Number(e.target.value);
            this.calculateFixedTotals();
        });
        this.DOMElements.incomeQ2Input.addEventListener('input', (e) => {
            this.state.incomeQ2 = Number(e.target.value);
            this.calculateFixedTotals();
        });
        this.DOMElements.saveFixedDataBtn.addEventListener('click', this.handleSaveFixedData.bind(this));

        // General Lists
        const listsContainer = document.querySelector('main');
        listsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-remove');
            if (btn) {
                const { list, index } = btn.dataset;
                this.handleRemoveItem(list, Number(index));
            }
        });
        listsContainer.addEventListener('input', (e) => {
            const { list, index, prop } = e.target.dataset;
             if (list && index && prop) this.handleInputChange(list, Number(index), prop, e.target.value);
        });
        
        // Auth buttons
        this.DOMElements.loginGoogleBtn.addEventListener('click', this.handleSignIn.bind(this));
        this.DOMElements.continueAnonymouslyBtn.addEventListener('click', async () => {
             try { await signInAnonymously(this.state.auth); } 
             catch (error) { this.displayAuthError(error); }
        });
        this.DOMElements.loginForAnonBtn.addEventListener('click', this.handleSignIn.bind(this));
        this.DOMElements.logoutBtn.addEventListener('click', async () => {
            try { await signOut(this.state.auth); } 
            catch (error) { console.error("Error signing out:", error); }
        });
    },

    switchView(viewId) {
        document.querySelectorAll('[data-view]').forEach(view => {
            view.style.display = 'none';
        });
        document.getElementById(viewId).style.display = 'block';
        
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${viewId}"]`).classList.add('active');
    },
    
    async handleSignIn() {
        this.DOMElements.authError.classList.add('hidden');
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(this.state.auth, provider);
        } catch (error) {
            this.displayAuthError(error);
        }
    },

    async handleSaveBudget() {
        const monthName = this.DOMElements.monthNameInput.value.trim();
        if (!monthName) {
            alert('Por favor, ingresa un nombre para el mes.'); return;
        }

        const totalAssetsValue = this.state.assets.concat(this.state.owed).reduce((sum, item) => sum + Number(item.amount), 0);
        const totalLiabilitiesValue = this.state.liabilities.reduce((sum, item) => item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount), 0);
        
        const budgetData = {
            monthName,
            assets: this.state.assets,
            owed: this.state.owed,
            liabilities: this.state.liabilities,
            savingsGoal: this.state.savingsGoal,
            totalAssets: totalAssetsValue,
            totalLiabilities: totalLiabilitiesValue,
            netWorth: totalAssetsValue - totalLiabilitiesValue,
            partialNetWorth: totalAssetsValue - this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0),
            createdAt: new Date().toISOString(),
            authorId: this.state.user ? this.state.user.uid : 'anonymous'
        };

        const success = await this.dataService.saveBudget(budgetData);
        if (success) {
            this.DOMElements.saveBudgetBtn.textContent = this.state.isAnonymous ? '¡Guardado Localmente!' : '¡Guardado!';
            setTimeout(() => { this.DOMElements.saveBudgetBtn.textContent = 'Guardar Mes'; }, 2000);
             if (this.state.isAnonymous) this.dataService.loadBudgets();
        } else { alert('Hubo un error al guardar el presupuesto.'); }
    },

    async handleSaveFixedData() {
        const data = {
            incomeQ1: this.state.incomeQ1,
            incomeQ2: this.state.incomeQ2,
            fixedExpensesQ1: this.state.fixedExpensesQ1,
            fixedExpensesQ2: this.state.fixedExpensesQ2,
        };
        const success = await this.dataService.saveFixedData(data);
        if (success) {
            this.DOMElements.saveFixedDataBtn.textContent = this.state.isAnonymous ? '¡Guardado Localmente!' : '¡Guardado!';
            setTimeout(() => { this.DOMElements.saveFixedDataBtn.textContent = 'Guardar Planeación'; }, 2000);
        } else { alert('Hubo un error al guardar la planeación.'); }
    },


    // --- STATE & FORM LOGIC ---
    resetForm() {
        this.state.assets = [
            { id: Date.now() + 1, name: 'Nequi', amount: 0 }, { id: Date.now() + 2, name: 'Uala', amount: 0 },
            { id: Date.now() + 3, name: 'Davivienda', amount: 0 }, { id: Date.now() + 4, name: 'Efectivo', amount: 0 },
        ];
        this.state.owed = [ { id: Date.now() + 5, name: 'Me deben', amount: 0 } ];
        this.state.liabilities = [
            { id: Date.now() + 6, name: 'Tarjeta de Crédito N', type: 'credit-card', total: 0, minimum: 0 },
            { id: Date.now() + 7, name: 'Tarjeta de Crédito V', type: 'credit-card', total: 0, minimum: 0 },
            { id: Date.now() + 8, name: 'Moto', type: 'standard', amount: 0 }, { id: Date.now() + 9, name: 'Arriendo', type: 'standard', amount: 0 },
            { id: Date.now() + 10, name: 'Servicios', type: 'standard', amount: 0 }, { id: Date.now() + 11, name: 'Mercado', type: 'standard', amount: 0 },
        ];
        this.state.savingsGoal = 0;
        this.DOMElements.monthNameInput.value = '';
        this.DOMElements.savingsGoalInput.value = 0;
        this.render();
    },


    // --- UTILITIES ---
    formatCurrency(value) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(value);
    },
    
    // --- RENDERING LOGIC ---
    createItemRow(item, listType, index) {
        const handleSVG = `<svg class="drag-handle w-5 h-5 text-gray-500 cursor-grab mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>`;

        if (listType === 'liabilities' && item.type === 'credit-card') {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex flex-col gap-2 p-2 border border-gray-700 rounded-md bg-gray-800 item-row';
            itemDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    ${handleSVG}
                    <input type="text" value="${item.name}" placeholder="Nombre Tarjeta" class="input-field w-full rounded-md p-2 font-semibold" data-index="${index}" data-list="${listType}" data-prop="name">
                    <button class="btn-remove flex-shrink-0" data-index="${index}" data-list="${listType}">-</button>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pl-8">
                    <div class="w-full flex-1 flex items-center gap-2">
                        <label class="text-sm text-gray-400 whitespace-nowrap">P. Total:</label>
                        <input type="number" value="${item.total}" placeholder="Total" class="input-field w-full rounded-md p-2 text-right" data-index="${index}" data-list="${listType}" data-prop="total">
                    </div>
                    <div class="w-full flex-1 flex items-center gap-2">
                        <label class="text-sm text-gray-400 whitespace-nowrap">P. Mínimo:</label>
                        <input type="number" value="${item.minimum}" placeholder="Mínimo" class="input-field w-full rounded-md p-2 text-right" data-index="${index}" data-list="${listType}" data-prop="minimum">
                    </div>
                </div>
            `;
            return itemDiv;
        }

        // Para 'assets', 'owed', 'fixedExpensesQ1', 'fixedExpensesQ2'
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-2 item-row';
        itemDiv.innerHTML = `
            ${handleSVG}
            <input type="text" value="${item.name}" placeholder="Nombre" class="input-field w-1/2 rounded-md p-2" data-index="${index}" data-list="${listType}" data-prop="name">
            <input type="number" value="${item.amount}" placeholder="Monto" class="input-field w-1/2 rounded-md p-2 text-right" data-index="${index}" data-list="${listType}" data-prop="amount">
            <button class="btn-remove" data-index="${index}" data-list="${listType}">-</button>
        `;
        return itemDiv;
    },

    render() {
        this.DOMElements.assetsList.innerHTML = '';
        this.DOMElements.owedList.innerHTML = '';
        this.DOMElements.liabilitiesList.innerHTML = '';
        this.DOMElements.fixedExpensesQ1List.innerHTML = '';
        this.DOMElements.fixedExpensesQ2List.innerHTML = '';
        
        this.state.assets.forEach((item, index) => this.DOMElements.assetsList.appendChild(this.createItemRow(item, 'assets', index)));
        this.state.owed.forEach((item, index) => this.DOMElements.owedList.appendChild(this.createItemRow(item, 'owed', index)));
        this.state.liabilities.forEach((item, index) => this.DOMElements.liabilitiesList.appendChild(this.createItemRow(item, 'liabilities', index)));
        this.state.fixedExpensesQ1.forEach((item, index) => this.DOMElements.fixedExpensesQ1List.appendChild(this.createItemRow(item, 'fixedExpensesQ1', index)));
        this.state.fixedExpensesQ2.forEach((item, index) => this.DOMElements.fixedExpensesQ2List.appendChild(this.createItemRow(item, 'fixedExpensesQ2', index)));
        
        this.calculateTotals();
        this.calculateFixedTotals();
    },
    
    renderSavedBudgets(docs) {
        this.DOMElements.noBudgetsMsg.style.display = 'none';
        this.DOMElements.savedBudgetsList.innerHTML = '';
        if (docs.length === 0) {
            this.DOMElements.noBudgetsMsg.textContent = "Aún no has guardado ningún presupuesto.";
            this.DOMElements.noBudgetsMsg.style.display = 'block';
            return;
        }
        
        docs.forEach(doc => {
            const budget = doc.data();
            const budgetCard = document.createElement('div');
            budgetCard.className = 'card relative cursor-pointer transform hover:scale-105 transition-transform duration-200';
            const netWorth = typeof budget.netWorth === 'number' ? budget.netWorth : 0;
            const partialNetWorth = typeof budget.partialNetWorth === 'number' ? budget.partialNetWorth : 0;
            
            budgetCard.innerHTML = `
                <button class="btn-remove btn-delete-month absolute top-3 right-3 w-6 h-6 text-xs z-10" data-doc-id="${doc.id}">X</button>
                <h3 class="text-xl font-bold text-white mb-2">${budget.monthName}</h3>
                <div class="text-xs text-gray-400">
                    <p class="mb-1">Parcial: <span class="${partialNetWorth >= 0 ? 'text-violet-400' : 'text-rose-400'} font-semibold">${this.formatCurrency(partialNetWorth)}</span></p>
                    <p>Total: <span class="${netWorth >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${this.formatCurrency(netWorth)}</span></p>
                </div>
                <p class="text-xs text-gray-500 mt-2">Guardado: ${new Date(budget.createdAt).toLocaleDateString()}</p>
            `;
            budgetCard.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-month')) {
                    e.stopPropagation();
                    const docId = e.target.closest('.btn-delete-month').dataset.docId;
                    if (docId) this.dataService.deleteBudget(docId);
                    return;
                }
                this.DOMElements.monthNameInput.value = budget.monthName;
                this.state.assets = structuredClone(budget.assets || []);
                this.state.owed = structuredClone(budget.owed || []);
                this.state.liabilities = structuredClone(budget.liabilities || []).map(item => ({ ...item, type: item.type || 'standard' }));
                this.state.savingsGoal = budget.savingsGoal || 0;
                this.DOMElements.savingsGoalInput.value = this.state.savingsGoal;
                this.render();
                this.switchView('monthly-budget-view');
            });
            this.DOMElements.savedBudgetsList.appendChild(budgetCard);
        });
    },

    // --- CALCULATION LOGIC ---
    calculateTotals() {
        const totalAssets = this.state.assets.concat(this.state.owed).reduce((sum, item) => sum + Number(item.amount), 0);
        const totalLiabilities = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount)), 0);
        const partialLiabilities = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0);
        const netWorth = totalAssets - totalLiabilities;
        const partialNetWorth = totalAssets - partialLiabilities;

        this.DOMElements.totalAssets.textContent = this.formatCurrency(totalAssets);
        this.DOMElements.totalLiabilities.textContent = this.formatCurrency(totalLiabilities);
        this.DOMElements.partialNetWorth.textContent = this.formatCurrency(partialNetWorth);
        this.DOMElements.partialNetWorth.style.color = partialNetWorth >= 0 ? '#A78BFA' : '#F472B6';
        this.DOMElements.netWorth.textContent = this.formatCurrency(netWorth);
        this.DOMElements.netWorth.style.color = netWorth >= 0 ? '#22C55E' : '#EF4444';

        // Savings Goal Calculation
        this.DOMElements.savingsGoalDisplay.textContent = this.formatCurrency(this.state.savingsGoal);
        const savedAmount = Math.max(0, netWorth);
        const progress = this.state.savingsGoal > 0 ? (savedAmount / this.state.savingsGoal) * 100 : 0;
        this.DOMElements.savingsProgressBar.style.width = `${Math.min(100, progress)}%`;
        this.DOMElements.savingsProgressText.textContent = `${this.formatCurrency(savedAmount)} de ${this.formatCurrency(this.state.savingsGoal)} ahorrados`;
    },

    calculateFixedTotals() {
        const totalQ1Expenses = this.state.fixedExpensesQ1.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalQ2Expenses = this.state.fixedExpensesQ2.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalIncome = this.state.incomeQ1 + this.state.incomeQ2;
        const totalExpenses = totalQ1Expenses + totalQ2Expenses;
        const monthlyBalance = totalIncome - totalExpenses;

        this.DOMElements.totalExpensesQ1.textContent = this.formatCurrency(totalQ1Expenses);
        this.DOMElements.totalExpensesQ2.textContent = this.formatCurrency(totalQ2Expenses);
        this.DOMElements.summaryTotalIncome.textContent = this.formatCurrency(totalIncome);
        this.DOMElements.summaryTotalExpenses.textContent = this.formatCurrency(totalExpenses);
        this.DOMElements.summaryMonthlyBalance.textContent = this.formatCurrency(monthlyBalance);
        this.DOMElements.summaryMonthlyBalance.style.color = monthlyBalance >= 0 ? '#22C55E' : '#EF4444';
    },
    
    updateFixedDataUI(data) {
        this.state.incomeQ1 = data.incomeQ1 || 0;
        this.state.incomeQ2 = data.incomeQ2 || 0;
        this.state.fixedExpensesQ1 = data.fixedExpensesQ1 || [];
        this.state.fixedExpensesQ2 = data.fixedExpensesQ2 || [];
        
        this.DOMElements.incomeQ1Input.value = this.state.incomeQ1;
        this.DOMElements.incomeQ2Input.value = this.state.incomeQ2;
        
        this.render();
    },

    // --- EVENT HANDLERS ---
    handleAddItem(itemType) {
        if (itemType === 'asset') this.state.assets.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'owed') this.state.owed.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'liability-standard') this.state.liabilities.push({ id: Date.now(), name: '', type: 'standard', amount: 0 });
        else if (itemType === 'liability-credit-card') this.state.liabilities.push({ id: Date.now(), name: 'Nueva Tarjeta', type: 'credit-card', total: 0, minimum: 0 });
        else if (itemType === 'fixedExpensesQ1') this.state.fixedExpensesQ1.push({ id: Date.now(), name: 'Nuevo Gasto Q1', amount: 0 });
        else if (itemType === 'fixedExpensesQ2') this.state.fixedExpensesQ2.push({ id: Date.now(), name: 'Nuevo Gasto Q2', amount: 0 });
        this.render();
    },

    handleRemoveItem(listType, index) {
        if (listType === 'assets') this.state.assets.splice(index, 1);
        else if (listType === 'owed') this.state.owed.splice(index, 1);
        else if (listType === 'liabilities') this.state.liabilities.splice(index, 1);
        else if (listType === 'fixedExpensesQ1') this.state.fixedExpensesQ1.splice(index, 1);
        else if (listType === 'fixedExpensesQ2') this.state.fixedExpensesQ2.splice(index, 1);
        this.render();
    },

    handleInputChange(listType, index, prop, value) {
        let list;
        if (listType === 'assets') list = this.state.assets;
        else if (listType === 'owed') list = this.state.owed;
        else if (listType === 'liabilities') list = this.state.liabilities;
        else if (listType === 'fixedExpensesQ1') list = this.state.fixedExpensesQ1;
        else if (listType === 'fixedExpensesQ2') list = this.state.fixedExpensesQ2;
        
        if (list && list[index]) {
            if (prop === 'amount' || prop === 'total' || prop === 'minimum') list[index][prop] = Number(value);
            else list[index][prop] = value;
            
            if (listType.startsWith('fixed')) this.calculateFixedTotals();
            else this.calculateTotals();
        }
    },
    
    // --- PWA & INITIAL LOAD ---
    setupPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registrado con éxito:', registration);
                    })
                    .catch(error => {
                        console.log('Error en el registro de ServiceWorker:', error);
                    });
            });
        }
    }
};

appController.init();

