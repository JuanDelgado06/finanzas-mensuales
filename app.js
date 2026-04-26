import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, linkWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { createDataService } from "./services/dataService.js";
import { createChartMethods } from "./services/charts.js";

const appController = {
    // --- STATE MANAGEMENT ---
    state: {
        // Monthly
        assets: [],
        owed: [],
        liabilities: [],
        savingsGoal: 0,
        microExpenseCategories: [],
        // System
        user: null,
        isAnonymous: true,
        savedBudgetsCount: 0,
        app: null,
        auth: null,
        savedBudgetDocs: [],

        // Charts
        charts: {
            assets: null,
            liabilities: null,
            microExpenses: null,
            comparison: null,
        },
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
        userMenuTrigger: document.getElementById('user-menu-trigger'),
        userInfoPanel: document.getElementById('user-info'),
        authError: document.getElementById('auth-error'),
        
        // Tabs
        tabMonthly: document.getElementById('tab-monthly'),
        tabMicroExpenses: document.getElementById('tab-micro-expenses'),
        tabCharts: document.getElementById('tab-charts'),
        monthlyBudgetView: document.getElementById('monthly-budget-view'),
        microExpensesView: document.getElementById('micro-expenses-view'),
        chartsView: document.getElementById('charts-view'),

        // Monthly Budget
        assetsList: document.getElementById('assets-list'),
        owedList: document.getElementById('owed-list'),
        liabilitiesList: document.getElementById('liabilities-list'),
        microExpensesList: document.getElementById('micro-expenses-list'),
        addAssetBtn: document.getElementById('add-asset'),
        addOwedBtn: document.getElementById('add-owed'),
        addLiabilityBtn: document.getElementById('add-liability'),
        addCreditCardBtn: document.getElementById('add-credit-card'),
        addMicroExpenseBtn: document.getElementById('add-micro-expense'),
        microCategoryNameInput: document.getElementById('micro-category-name'),
        addMicroCategoryBtn: document.getElementById('add-micro-category'),
        saveBudgetMicroBtn: document.getElementById('save-budget-micro'),
        totalAssets: document.getElementById('total-assets'),
        totalLiabilities: document.getElementById('total-liabilities'),
        totalMicroExpenses: document.getElementById('total-micro-expenses'),
        monthlyMicroExpensesTotal: document.getElementById('monthly-micro-expenses-total'),
        partialNetWorth: document.getElementById('partial-net-worth'),
        netWorth: document.getElementById('net-worth'),
        monthNameInput: document.getElementById('month-name'),
        saveBudgetBtn: document.getElementById('save-budget'),
        clearFormBtn: document.getElementById('clear-form-btn'),
        savedBudgetsList: document.getElementById('saved-budgets-list'),
        noBudgetsMsg: document.getElementById('no-budgets'),
        savedDateFromInput: document.getElementById('saved-date-from'),
        savedDateToInput: document.getElementById('saved-date-to'),
        clearDateFilterBtn: document.getElementById('clear-date-filter'),
        filterTodayBtn: document.getElementById('filter-today'),
        filterLast7DaysBtn: document.getElementById('filter-last-7-days'),
        filterThisMonthBtn: document.getElementById('filter-this-month'),
        filterLastMonthBtn: document.getElementById('filter-last-month'),
        savedDateFilterStatus: document.getElementById('saved-date-filter-status'),
        quickCardAssets: document.getElementById('quick-card-assets'),
        quickCardGoals: document.getElementById('quick-card-goals'),
        quickCardBalance: document.getElementById('quick-card-balance'),
        mainNavTabs: document.getElementById('main-nav-tabs'),
        headerAssetsValue: document.getElementById('header-assets-value'),
        headerGoalsValue: document.getElementById('header-goals-value'),
        headerBalanceValue: document.getElementById('header-balance-value'),

        // Charts
        assetsChart: document.getElementById('assets-chart'),
        liabilitiesChart: document.getElementById('liabilities-chart'),
        microExpensesChart: document.getElementById('micro-expenses-chart'),
        comparisonChart: document.getElementById('comparison-chart'),
    },

    // --- INITIALIZATION ---
    async init() {
        this.resetForm();
        this.bindEvents();
        this.setupFloatingNavSafeArea();
        await this.initializeFirebase();
        this.setupPWA();
        this.initializeSortable();
        
        // Initialize charts after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateCharts();
        }, 500);
    },

    setupFloatingNavSafeArea() {
        const updateSafeArea = () => {
            const nav = this.DOMElements.mainNavTabs;
            if (!nav) return;
            const navHeight = Math.ceil(nav.getBoundingClientRect().height);
            const offset = 18;
            const minSafeHeight = 92;
            const safeHeight = Math.max(navHeight + offset, minSafeHeight);
            document.documentElement.style.setProperty('--bottom-nav-safe-height', `${safeHeight}px`);
        };

        updateSafeArea();
        window.addEventListener('resize', updateSafeArea);
        window.addEventListener('load', updateSafeArea);
        setTimeout(updateSafeArea, 300);
        setTimeout(updateSafeArea, 900);
    },

    setupUserSessionMenu() {
        if (this.userSessionMenuInitialized) return;

        const { userMenuTrigger, userInfoPanel } = this.DOMElements;
        if (!userMenuTrigger || !userInfoPanel) return;

        this.userSessionMenuInitialized = true;

        const closeMenu = () => {
            userInfoPanel.classList.add('hidden');
            userMenuTrigger.setAttribute('aria-expanded', 'false');
        };

        const openMenu = () => {
            userInfoPanel.classList.remove('hidden');
            userMenuTrigger.setAttribute('aria-expanded', 'true');
        };

        this.closeUserSessionMenu = closeMenu;

        userMenuTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = !userInfoPanel.classList.contains('hidden');
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        userMenuTrigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                userMenuTrigger.click();
            }
        });

        userInfoPanel.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!userInfoPanel.contains(target) && !userMenuTrigger.contains(target)) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });
    },

    initializeSortable() {
        const lists = [
            { element: this.DOMElements.assetsList, array: 'assets' },
            { element: this.DOMElements.owedList, array: 'owed' },
            { element: this.DOMElements.liabilitiesList, array: 'liabilities' },
            { element: this.DOMElements.microExpensesList, array: 'microExpenses' },
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
            let response = await fetch('/api/config');
            if (!response.ok) {
                console.warn('No se encontró /api/config, intentando config.local.json');
                response = await fetch('/config.local.json');
            }

            if (!response.ok) {
                throw new Error(`Error fetching config: ${response.statusText}`);
            }

            const firebaseConfig = await response.json();

            if (firebaseConfig && firebaseConfig.apiKey) {
                this.state.app = initializeApp(firebaseConfig);
                this.state.auth = getAuth(this.state.app);
                this.setupAuthObserver();
            } else {
                this.showError("La configuración de Firebase no es válida. Añade tu config local en config.local.json o usa Vercel.");
            }
        } catch (error) {
            console.error("No se pudo cargar la configuración de Firebase desde el servidor.", error);
            this.showError("No se pudo conectar con la configuración de Firebase. Usa Vercel o crea config.local.json.");
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
            this.state.user = user;
            this.state.isAnonymous = user ? user.isAnonymous : true;
            
            this.DOMElements.loaderView.style.display = 'none'; // Oculta el cargador
            
            if (user) {
                if (!user.isAnonymous && (localStorage.getItem('anonymousBudgets') || localStorage.getItem('anonymousConfig'))) {
                    await this.dataService.migrateLocalDataToMongo();
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
                }
                this.closeUserSessionMenu?.();
                await this.dataService.loadBudgets();
            } else {
                this.DOMElements.appView.style.display = 'none';
                this.DOMElements.loginView.style.display = 'flex'; // Muestra el login
                this.DOMElements.loginForAnonBtn.classList.add('hidden');
                this.DOMElements.authError.classList.add('hidden');
                this.closeUserSessionMenu?.();
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
    
    // --- UI & EVENT BINDING ---
    bindEvents() {
        // Tabs
        this.DOMElements.tabMonthly = document.getElementById('tab-monthly');
        this.DOMElements.tabMicroExpenses = document.getElementById('tab-micro-expenses');
        this.DOMElements.tabCharts = document.getElementById('tab-charts');
        this.DOMElements.tabMonthly.addEventListener('click', () => this.switchView('monthly-budget-view'));
        this.DOMElements.tabMicroExpenses.addEventListener('click', () => this.switchView('micro-expenses-view'));
        this.DOMElements.tabCharts.addEventListener('click', () => this.switchView('charts-view'));

        // Monthly Budget
        this.DOMElements.addAssetBtn.addEventListener('click', () => this.handleAddItem('asset'));
        this.DOMElements.addOwedBtn.addEventListener('click', () => this.handleAddItem('owed'));
        this.DOMElements.addLiabilityBtn.addEventListener('click', () => this.handleAddItem('liability-standard'));
        this.DOMElements.addCreditCardBtn.addEventListener('click', () => this.handleAddItem('liability-credit-card'));
        this.DOMElements.addMicroExpenseBtn.addEventListener('click', () => this.handleAddItem('micro-expense'));
        if (this.DOMElements.addMicroCategoryBtn) {
            this.DOMElements.addMicroCategoryBtn.addEventListener('click', () => this.handleAddMicroCategory());
        }
        if (this.DOMElements.microCategoryNameInput) {
            this.DOMElements.microCategoryNameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.handleAddMicroCategory();
                }
            });
        }
        this.DOMElements.saveBudgetBtn.addEventListener('click', this.handleSaveBudget.bind(this));
        if (this.DOMElements.saveBudgetMicroBtn) {
            this.DOMElements.saveBudgetMicroBtn.addEventListener('click', async () => {
                if (!this.DOMElements.monthNameInput.value.trim()) {
                    const now = new Date();
                    const monthLabel = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                    this.DOMElements.monthNameInput.value = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
                }
                await this.handleSaveBudget();
            });
        }
        this.DOMElements.clearFormBtn.addEventListener('click', this.resetForm.bind(this));

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

        if (this.DOMElements.savedDateFromInput) {
            this.DOMElements.savedDateFromInput.addEventListener('input', () => this.applySavedBudgetsFilters());
        }
        if (this.DOMElements.savedDateToInput) {
            this.DOMElements.savedDateToInput.addEventListener('input', () => this.applySavedBudgetsFilters());
        }
        if (this.DOMElements.clearDateFilterBtn) {
            this.DOMElements.clearDateFilterBtn.addEventListener('click', () => {
                if (this.DOMElements.savedDateFromInput) this.DOMElements.savedDateFromInput.value = '';
                if (this.DOMElements.savedDateToInput) this.DOMElements.savedDateToInput.value = '';
                this.applySavedBudgetsFilters();
            });
        }
        if (this.DOMElements.filterTodayBtn) {
            this.DOMElements.filterTodayBtn.addEventListener('click', () => this.applyQuickDatePreset('today'));
        }
        if (this.DOMElements.filterLast7DaysBtn) {
            this.DOMElements.filterLast7DaysBtn.addEventListener('click', () => this.applyQuickDatePreset('last7days'));
        }
        if (this.DOMElements.filterThisMonthBtn) {
            this.DOMElements.filterThisMonthBtn.addEventListener('click', () => this.applyQuickDatePreset('thisMonth'));
        }
        if (this.DOMElements.filterLastMonthBtn) {
            this.DOMElements.filterLastMonthBtn.addEventListener('click', () => this.applyQuickDatePreset('lastMonth'));
        }

        this.setupUserSessionMenu();
        this.setupQuickCardsNavigation();
    },

    setupQuickCardsNavigation() {
        const bindCardAction = (element, action) => {
            if (!element) return;
            element.addEventListener('click', action);
            element.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    action();
                }
            });
        };

        bindCardAction(this.DOMElements.quickCardAssets, () => this.switchView('monthly-budget-view'));
        bindCardAction(this.DOMElements.quickCardGoals, () => this.switchView('micro-expenses-view'));
        bindCardAction(this.DOMElements.quickCardBalance, () => this.switchView('charts-view'));
    },

    updateDashboardHighlights() {
        const totalAssets = this.state.assets.concat(this.state.owed).reduce((sum, item) => sum + Number(item.amount), 0);
        const totalMicroExpenses = this.state.microExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const liabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount)), 0);
        const partialLiabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0);
        const totalLiabilities = liabilitiesWithoutMicro + totalMicroExpenses;
        const partialLiabilities = partialLiabilitiesWithoutMicro + totalMicroExpenses;
        const netWorth = totalAssets - totalLiabilities;
        const availableNow = netWorth;
        const potentialSavings = totalAssets - partialLiabilities;
        const debtCoverage = totalLiabilities > 0 ? Math.round((totalAssets / totalLiabilities) * 100) : 100;

        const toneClasses = ['text-white', 'text-green-300', 'text-rose-300', 'text-amber-300', 'text-sky-300'];

        if (this.DOMElements.headerAssetsValue) {
            this.DOMElements.headerAssetsValue.textContent = this.formatCurrency(availableNow);
            this.DOMElements.headerAssetsValue.classList.remove(...toneClasses);
            this.DOMElements.headerAssetsValue.classList.add(availableNow >= 0 ? 'text-green-300' : 'text-rose-300');
        }

        if (this.DOMElements.headerGoalsValue) {
            this.DOMElements.headerGoalsValue.textContent = potentialSavings >= 0
                ? this.formatCurrency(potentialSavings)
                : `-${this.formatCurrency(Math.abs(potentialSavings))}`;
            this.DOMElements.headerGoalsValue.classList.remove(...toneClasses);
            this.DOMElements.headerGoalsValue.classList.add(potentialSavings >= 0 ? 'text-sky-300' : 'text-amber-300');
        }

        if (this.DOMElements.headerBalanceValue) {
            this.DOMElements.headerBalanceValue.textContent = `${debtCoverage}% cobertura`;
            this.DOMElements.headerBalanceValue.classList.remove(...toneClasses);
            if (debtCoverage >= 100 && netWorth >= 0) {
                this.DOMElements.headerBalanceValue.classList.add('text-green-300');
            } else if (debtCoverage >= 70) {
                this.DOMElements.headerBalanceValue.classList.add('text-amber-300');
            } else {
                this.DOMElements.headerBalanceValue.classList.add('text-rose-300');
            }
        }
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

        // Update charts when switching to charts view
        if (viewId === 'charts-view') {
            setTimeout(() => this.updateCharts(), 100); // Small delay to ensure DOM is ready
        }
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
        const totalMicroExpensesValue = this.state.microExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const liabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount), 0);
        const partialLiabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0);
        const totalLiabilitiesValue = liabilitiesWithoutMicro + totalMicroExpensesValue;
        const partialLiabilitiesAmount = partialLiabilitiesWithoutMicro + totalMicroExpensesValue;

        const budgetData = {
            monthName,
            assets: this.state.assets,
            owed: this.state.owed,
            liabilities: this.state.liabilities,
            microExpenses: this.state.microExpenses,
            microExpenseCategories: this.state.microExpenseCategories,
            totalAssets: totalAssetsValue,
            totalLiabilities: totalLiabilitiesValue,
            netWorth: totalAssetsValue - totalLiabilitiesValue,
            partialNetWorth: totalAssetsValue - partialLiabilitiesAmount,
            createdAt: new Date().toISOString(),
            authorId: this.state.user ? this.state.user.uid : 'anonymous',
            authorName: this.state.user ? (this.state.user.displayName || null) : 'Invitado',
            authorEmail: this.state.user ? (this.state.user.email || null) : null
        };

        const success = await this.dataService.saveBudget(budgetData);
        if (success) {
            this.DOMElements.saveBudgetBtn.textContent = this.state.isAnonymous ? '¡Guardado Localmente!' : '¡Guardado!';
            setTimeout(() => { this.DOMElements.saveBudgetBtn.textContent = 'Guardar Mes'; }, 2000);
            await this.dataService.loadBudgets();
        } else { alert('Hubo un error al guardar el presupuesto.'); }
    },


    // --- STATE & FORM LOGIC ---
    resetForm() {
        this.state.microExpenseCategories = this.getDefaultMicroExpenseCategories();
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
        this.state.microExpenses = [];
        this.DOMElements.monthNameInput.value = '';
        this.render();
        this.updateDashboardHighlights();
    },


    // --- UTILITIES ---
    formatCurrency(value) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(value);
    },

    getDefaultMicroExpenseCategories() {
        return [
            'General',
            'Comida',
            'Transporte',
            'Cafe',
            'Snacks',
            'Antojos',
            'Mercado rapido',
            'Apps',
            'Streaming',
            'Hogar',
            'Salud',
            'Mascotas',
            'Regalos',
            'Otros'
        ];
    },

    sanitizeCategoryName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    },

    buildPaymentMethodOptions(selectedMethod) {
        const sources = this.state.assets.concat(this.state.owed)
            .map(item => String(item.name || '').trim())
            .filter(name => name.length > 0);
        const options = sources.length > 0 ? sources : ['Efectivo'];
        if (selectedMethod && !options.includes(selectedMethod)) {
            options.unshift(selectedMethod);
        }
        const current = selectedMethod || options[0];
        return options.map(opt => {
            const sel = opt === current ? 'selected' : '';
            return `<option value="${opt}" ${sel}>${opt}</option>`;
        }).join('');
    },

    buildMicroExpenseCategoryOptions(selectedCategory) {
        const categories = this.state.microExpenseCategories && this.state.microExpenseCategories.length > 0
            ? this.state.microExpenseCategories
            : this.getDefaultMicroExpenseCategories();
        const currentCategory = this.sanitizeCategoryName(selectedCategory) || categories[0];

        if (!categories.includes(currentCategory)) {
            categories.push(currentCategory);
            this.state.microExpenseCategories = categories;
        }

        return categories.map((category) => {
            const selectedAttr = category === currentCategory ? 'selected' : '';
            return `<option value="${category}" ${selectedAttr}>${category}</option>`;
        }).join('');
    },

    ensureMicroExpenseCategoriesConsistency() {
        if (!Array.isArray(this.state.microExpenseCategories) || this.state.microExpenseCategories.length === 0) {
            this.state.microExpenseCategories = this.getDefaultMicroExpenseCategories();
        }

        this.state.microExpenses.forEach((item) => {
            const category = this.sanitizeCategoryName(item.category) || this.state.microExpenseCategories[0];
            item.category = category;
            if (!this.state.microExpenseCategories.includes(category)) {
                this.state.microExpenseCategories.push(category);
            }
        });
    },

    handleAddMicroCategory() {
        const input = this.DOMElements.microCategoryNameInput;
        if (!input) return;

        const newCategory = this.sanitizeCategoryName(input.value);
        if (!newCategory) return;
        if (this.state.microExpenseCategories.includes(newCategory)) {
            input.value = '';
            return;
        }

        this.state.microExpenseCategories.push(newCategory);
        input.value = '';
        this.render();
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
                    <button type="button" class="btn-remove flex-shrink-0" data-index="${index}" data-list="${listType}">-</button>
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

        const itemDiv = document.createElement('div');
        if (listType === 'microExpenses') {
            itemDiv.className = 'flex items-center gap-2 item-row';
            itemDiv.innerHTML = `
                ${handleSVG}
                <select class="input-field flex-1 min-w-0 rounded-md p-2" data-index="${index}" data-list="${listType}" data-prop="category">${this.buildMicroExpenseCategoryOptions(item.category)}</select>
                <select class="input-field flex-1 min-w-0 rounded-md p-2" data-index="${index}" data-list="${listType}" data-prop="paymentMethod">${this.buildPaymentMethodOptions(item.paymentMethod)}</select>
                <input type="number" value="${item.amount}" placeholder="Monto" class="input-field w-28 flex-shrink-0 rounded-md p-2 text-right" data-index="${index}" data-list="${listType}" data-prop="amount">
                <button type="button" class="btn-remove flex-shrink-0" data-index="${index}" data-list="${listType}">-</button>
            `;
            return itemDiv;
        }
        itemDiv.className = 'flex items-center gap-2 item-row';
        const placeholder = 'Nombre';
        const nameInput = `<input type="text" value="${item.name}" placeholder="${placeholder}" class="input-field w-1/2 rounded-md p-2" data-index="${index}" data-list="${listType}" data-prop="name">`;
        itemDiv.innerHTML = `
            ${handleSVG}
            ${nameInput}
            <input type="number" value="${item.amount}" placeholder="Monto" class="input-field w-1/2 rounded-md p-2 text-right" data-index="${index}" data-list="${listType}" data-prop="amount">
            <button type="button" class="btn-remove" data-index="${index}" data-list="${listType}">-</button>
        `;
        return itemDiv;
    },

    render() {
        this.ensureMicroExpenseCategoriesConsistency();

        this.DOMElements.assetsList.innerHTML = '';
        this.DOMElements.owedList.innerHTML = '';
        this.DOMElements.liabilitiesList.innerHTML = '';
        this.DOMElements.microExpensesList.innerHTML = '';
        
        this.state.assets.forEach((item, index) => this.DOMElements.assetsList.appendChild(this.createItemRow(item, 'assets', index)));
        this.state.owed.forEach((item, index) => this.DOMElements.owedList.appendChild(this.createItemRow(item, 'owed', index)));
        this.state.liabilities.forEach((item, index) => this.DOMElements.liabilitiesList.appendChild(this.createItemRow(item, 'liabilities', index)));
        this.state.microExpenses.forEach((item, index) => this.DOMElements.microExpensesList.appendChild(this.createItemRow(item, 'microExpenses', index)));
        
        this.calculateTotals();
    },
    
    getSavedBudgetTimestamp(budget) {
        if (!budget || !budget.createdAt) return null;
        const timestamp = new Date(budget.createdAt).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    },

    applySavedBudgetsFilters() {
        const allDocs = this.state.savedBudgetDocs || [];
        const fromValue = this.DOMElements.savedDateFromInput ? this.DOMElements.savedDateFromInput.value : '';
        const toValue = this.DOMElements.savedDateToInput ? this.DOMElements.savedDateToInput.value : '';
        const fromDate = fromValue ? new Date(`${fromValue}T00:00:00`).getTime() : null;
        const toDate = toValue ? new Date(`${toValue}T23:59:59.999`).getTime() : null;

        const filteredDocs = allDocs.filter((doc) => {
            const budget = doc.data();
            const timestamp = this.getSavedBudgetTimestamp(budget);

            if (timestamp === null) {
                return !fromDate && !toDate;
            }
            if (fromDate && timestamp < fromDate) return false;
            if (toDate && timestamp > toDate) return false;
            return true;
        });

        this.renderSavedBudgetsList(filteredDocs, allDocs.length, Boolean(fromDate || toDate));
    },

    toInputDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    applyQuickDatePreset(preset) {
        const now = new Date();
        let fromDate;
        let toDate;

        if (preset === 'today') {
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (preset === 'last7days') {
            toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        } else if (preset === 'thisMonth') {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (preset === 'lastMonth') {
            fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            toDate = new Date(now.getFullYear(), now.getMonth(), 0);
        } else {
            return;
        }

        if (this.DOMElements.savedDateFromInput) {
            this.DOMElements.savedDateFromInput.value = this.toInputDate(fromDate);
        }
        if (this.DOMElements.savedDateToInput) {
            this.DOMElements.savedDateToInput.value = this.toInputDate(toDate);
        }

        this.applySavedBudgetsFilters();
    },

    renderSavedBudgets(docs) {
        this.state.savedBudgetDocs = docs;
        this.state.savedBudgetsCount = docs.length;
        this.applySavedBudgetsFilters();
    },

    renderSavedBudgetsList(docs, totalDocs, hasActiveDateFilter) {
        this.DOMElements.noBudgetsMsg.style.display = 'none';
        this.DOMElements.savedBudgetsList.innerHTML = '';

        if (this.DOMElements.savedDateFilterStatus) {
            const fromValue = this.DOMElements.savedDateFromInput ? this.DOMElements.savedDateFromInput.value : '';
            const toValue = this.DOMElements.savedDateToInput ? this.DOMElements.savedDateToInput.value : '';
            if (hasActiveDateFilter) {
                const fromLabel = fromValue || 'inicio';
                const toLabel = toValue || 'hoy';
                this.DOMElements.savedDateFilterStatus.textContent = `Mostrando ${docs.length} de ${totalDocs} presupuestos (${fromLabel} a ${toLabel}).`;
            } else {
                this.DOMElements.savedDateFilterStatus.textContent = `Mostrando ${docs.length} presupuestos guardados.`;
            }
        }

        if (docs.length === 0) {
            this.DOMElements.noBudgetsMsg.textContent = hasActiveDateFilter
                ? 'No hay presupuestos en el rango de fechas seleccionado.'
                : 'Aún no has guardado ningún presupuesto.';
            this.DOMElements.noBudgetsMsg.style.display = 'block';
            this.updateDashboardHighlights();
            return;
        }
        
        docs.forEach(doc => {
            const budget = doc.data();
            const budgetCard = document.createElement('div');
            budgetCard.className = 'card relative cursor-pointer transform hover:scale-105 transition-transform duration-200';
            const budgetAssetsTotal = (budget.assets || []).concat(budget.owed || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const budgetLiabilitiesTotal = (budget.liabilities || []).reduce((sum, item) => {
                if (item.type === 'credit-card') return sum + Number(item.total || 0);
                return sum + Number(item.amount || 0);
            }, 0);
            const budgetPartialLiabilities = (budget.liabilities || []).reduce((sum, item) => {
                if (item.type === 'credit-card') return sum + Number(item.minimum || 0);
                return sum + Number(item.amount || 0);
            }, 0);
            const budgetMicroExpenses = (budget.microExpenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const netWorth = budgetAssetsTotal - (budgetLiabilitiesTotal + budgetMicroExpenses);
            const partialNetWorth = budgetAssetsTotal - (budgetPartialLiabilities + budgetMicroExpenses);
            const ownerLabel = budget.authorName || budget.authorEmail || budget.authorId || 'Desconocido';
            
            budgetCard.innerHTML = `
                <button type="button" class="btn-remove btn-delete-month absolute top-3 right-3 w-6 h-6 text-xs z-10" data-doc-id="${doc.id}">X</button>
                <h3 class="text-xl font-bold text-white mb-2">${budget.monthName}</h3>
                <div class="text-xs text-gray-400">
                    <p class="mb-1">Parcial: <span class="${partialNetWorth >= 0 ? 'text-violet-400' : 'text-rose-400'} font-semibold">${this.formatCurrency(partialNetWorth)}</span></p>
                    <p>Total: <span class="${netWorth >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${this.formatCurrency(netWorth)}</span></p>
                </div>
                <p class="text-xs text-gray-500 mt-2">Usuario: ${ownerLabel}</p>
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
                this.state.microExpenses = structuredClone(budget.microExpenses || []);
                this.state.microExpenseCategories = Array.isArray(budget.microExpenseCategories) && budget.microExpenseCategories.length > 0
                    ? structuredClone(budget.microExpenseCategories)
                    : this.getDefaultMicroExpenseCategories();
                this.render();
                this.updateCharts(); // Update charts when loading a saved budget
                this.switchView('monthly-budget-view');
            });
            this.DOMElements.savedBudgetsList.appendChild(budgetCard);
        });

        this.updateDashboardHighlights();
    },

    // --- CALCULATION LOGIC ---
    calculateTotals() {
        const totalAssets = this.state.assets.concat(this.state.owed).reduce((sum, item) => sum + Number(item.amount), 0);
        const totalMicroExpenses = this.state.microExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const liabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount)), 0);
        const partialLiabilitiesWithoutMicro = this.state.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0);
        const totalLiabilities = liabilitiesWithoutMicro + totalMicroExpenses;
        const partialLiabilities = partialLiabilitiesWithoutMicro + totalMicroExpenses;
        const netWorth = totalAssets - totalLiabilities;
        const partialNetWorth = totalAssets - partialLiabilities;

        this.DOMElements.totalAssets.textContent = this.formatCurrency(totalAssets);
        this.DOMElements.totalLiabilities.textContent = this.formatCurrency(totalLiabilities);
        this.DOMElements.totalMicroExpenses.textContent = this.formatCurrency(totalMicroExpenses);
        if (this.DOMElements.monthlyMicroExpensesTotal) {
            this.DOMElements.monthlyMicroExpensesTotal.textContent = this.formatCurrency(totalMicroExpenses);
        }
        this.DOMElements.partialNetWorth.textContent = this.formatCurrency(partialNetWorth);
        this.DOMElements.partialNetWorth.style.color = partialNetWorth >= 0 ? '#A78BFA' : '#F472B6';
        this.DOMElements.netWorth.textContent = this.formatCurrency(netWorth);
        this.DOMElements.netWorth.style.color = netWorth >= 0 ? '#22C55E' : '#EF4444';
        this.updateDashboardHighlights();
    },
    
    // --- EVENT HANDLERS ---
    handleAddItem(itemType) {
        if (itemType === 'asset') this.state.assets.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'owed') this.state.owed.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'liability-standard') this.state.liabilities.push({ id: Date.now(), name: '', type: 'standard', amount: 0 });
        else if (itemType === 'liability-credit-card') this.state.liabilities.push({ id: Date.now(), name: 'Nueva Tarjeta', type: 'credit-card', total: 0, minimum: 0 });
        else if (itemType === 'micro-expense') {
            const defaultPayment = this.state.assets.concat(this.state.owed).find(a => String(a.name || '').trim());
            this.state.microExpenses.push({ id: Date.now(), name: '', amount: 0, category: this.state.microExpenseCategories[0] || 'General', paymentMethod: defaultPayment ? defaultPayment.name.trim() : '' });
        }
        this.render();
        this.updateCharts(); // Update charts when data changes
    },

    handleRemoveItem(listType, index) {
        if (listType === 'assets') this.state.assets.splice(index, 1);
        else if (listType === 'owed') this.state.owed.splice(index, 1);
        else if (listType === 'liabilities') this.state.liabilities.splice(index, 1);
        else if (listType === 'microExpenses') this.state.microExpenses.splice(index, 1);
        this.render();
        this.updateCharts(); // Update charts when data changes
    },

    handleInputChange(listType, index, prop, value) {
        let list;
        if (listType === 'assets') list = this.state.assets;
        else if (listType === 'owed') list = this.state.owed;
        else if (listType === 'liabilities') list = this.state.liabilities;
        else if (listType === 'microExpenses') list = this.state.microExpenses;
        
        if (list && list[index]) {
            if (prop === 'amount' || prop === 'total' || prop === 'minimum') list[index][prop] = Number(value);
            else list[index][prop] = value;
            
            // When an asset/owed name changes, refresh payment method options in all micro expense rows
            if ((listType === 'assets' || listType === 'owed') && prop === 'name') {
                this.DOMElements.microExpensesList.querySelectorAll('select[data-prop="paymentMethod"]').forEach((sel) => {
                    const idx = Number(sel.dataset.index);
                    const current = this.state.microExpenses[idx] ? this.state.microExpenses[idx].paymentMethod : '';
                    sel.innerHTML = this.buildPaymentMethodOptions(current);
                });
            }

            this.calculateTotals();
            this.updateCharts();
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

appController.dataService = createDataService(appController);
Object.assign(appController, createChartMethods(appController));

appController.init();

