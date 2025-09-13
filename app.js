// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, linkWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===================================================================================
// --- 1. SERVICIO DE DATOS (FIREBASE & LOCALSTORAGE) ---
// ===================================================================================
const dataService = {
    app: null,
    db: null,
    auth: null,
    userId: null,
    budgetsCol: null,
    isAnonymousUser: false,
    unsubscribeFromBudgets: null,

    async initializeFirebase(onAuthStateChangeCallback) {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const firebaseConfig = await response.json();

            if (firebaseConfig && firebaseConfig.apiKey) {
                this.app = initializeApp(firebaseConfig);
                this.db = getFirestore(this.app);
                this.auth = getAuth(this.app);
                this.setupAuthObserver(onAuthStateChangeCallback);
                return true;
            }
            throw new Error("Invalid Firebase config received from server");
        } catch (error) {
            console.error("Could not initialize Firebase:", error);
            return false;
        }
    },

    setupAuthObserver(onUserChanged) {
        onAuthStateChanged(this.auth, async (user) => {
            if (this.unsubscribeFromBudgets) this.unsubscribeFromBudgets();

            this.userId = user ? user.uid : null;
            this.isAnonymousUser = user ? user.isAnonymous : false;
            
            if (user && !user.isAnonymous) {
                 if (localStorage.getItem('anonymousBudgets')) {
                    await this.migrateLocalDataToFirestore(user.uid);
                }
                this.budgetsCol = collection(this.db, `budgets/${this.userId}/items`);
            }
            onUserChanged(user);
        });
    },

    signInWithGoogle: () => signInWithPopup(getAuth(), new GoogleAuthProvider()),
    continueAnonymously: () => signInAnonymously(getAuth()),
    signOutUser: () => signOut(getAuth()),

    async migrateLocalDataToFirestore(newUserId) {
        const localBudgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
        if (localBudgets.length === 0) return;

        const newBudgetsCol = collection(getFirestore(), `budgets/${newUserId}/items`);
        const promises = localBudgets.map(budget => {
            const docRef = doc(newBudgetsCol, budget.monthName.replace(/ /g, '-'));
            return setDoc(docRef, budget);
        });
        await Promise.all(promises);
        localStorage.removeItem('anonymousBudgets');
    },

    async saveBudget(budgetData) {
        if (this.isAnonymousUser) {
            let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
            const existingIndex = budgets.findIndex(b => b.monthName === budgetData.monthName);
            if (existingIndex > -1) budgets[existingIndex] = budgetData;
            else budgets.push(budgetData);
            localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
        } else {
            const budgetDocRef = doc(this.budgetsCol, budgetData.monthName.replace(/ /g, '-'));
            await setDoc(budgetDocRef, budgetData);
        }
    },

    deleteBudget(docId) {
        if (this.isAnonymousUser) {
            let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
            const monthName = docId.replace(/-/g, ' ');
            budgets = budgets.filter(b => b.monthName !== monthName);
            localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
        } else {
            deleteDoc(doc(this.budgetsCol, docId));
        }
    },

    loadBudgets(renderCallback) {
        if (this.isAnonymousUser) {
            const budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
            const docs = budgets.map(b => ({ id: b.monthName.replace(/ /g, '-'), data: () => b }));
            renderCallback(docs);
        } else if (this.budgetsCol) {
            this.unsubscribeFromBudgets = onSnapshot(this.budgetsCol, (snapshot) => {
                renderCallback(snapshot.docs);
            }, (error) => {
                console.error("Error in Firestore snapshot listener:", error);
                renderCallback([], "Error al cargar datos. Permisos insuficientes.");
            });
        }
    }
};

// ===================================================================================
// --- 2. CONTROLADOR DE LA APLICACIÓN (UI & LÓGICA) ---
// ===================================================================================
const appController = {
    assets: [],
    owed: [],
    liabilities: [],
    DOMElements: {
        loginView: document.getElementById('login-view'),
        appView: document.getElementById('app-view'),
        loginGoogleBtn: document.getElementById('login-google-btn'),
        continueAnonymouslyBtn: document.getElementById('continue-anonymously-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        loginForAnonBtn: document.getElementById('login-for-anon-btn'),
        userDisplay: document.getElementById('user-display'),
        authError: document.getElementById('auth-error'),
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
        savedBudgetsList: document.getElementById('saved-budgets-list'),
        noBudgetsMsg: document.getElementById('no-budgets'),
        savingsGoalInput: document.getElementById('savings-goal'),
        savingsProgressBar: document.getElementById('savings-progress-bar'),
        savingsProgressText: document.getElementById('savings-progress-text'),
        savingsProgressPercent: document.getElementById('savings-progress-percent'),
    },

    async init() {
        this.setupEventListeners();
        const firebaseReady = await dataService.initializeFirebase(this.handleAuthStateChange.bind(this));
        if (!firebaseReady) {
            this.DOMElements.loginView.innerHTML = `<div class="text-center card"><h1 class="text-2xl font-bold text-white mb-4">Error de Configuración</h1><p class="text-red-400">No se pudo cargar la configuración de Firebase desde el servidor. Revisa las variables de entorno en Vercel.</p></div>`;
        }
        this.resetForm();
        this.setupPWA();
    },

    setupEventListeners() {
        this.DOMElements.loginGoogleBtn.addEventListener('click', () => this.handleAuthAction(dataService.signInWithGoogle));
        this.DOMElements.continueAnonymouslyBtn.addEventListener('click', () => this.handleAuthAction(dataService.continueAnonymously));
        this.DOMElements.loginForAnonBtn.addEventListener('click', () => this.handleAuthAction(dataService.signInWithGoogle));
        this.DOMElements.logoutBtn.addEventListener('click', () => this.handleAuthAction(dataService.signOutUser));
        this.DOMElements.saveBudgetBtn.addEventListener('click', () => this.saveBudget());
        this.DOMElements.addAssetBtn.addEventListener('click', () => this.handleAddItem('asset'));
        this.DOMElements.addOwedBtn.addEventListener('click', () => this.handleAddItem('owed'));
        this.DOMElements.addLiabilityBtn.addEventListener('click', () => this.handleAddItem('liability-standard'));
        this.DOMElements.addCreditCardBtn.addEventListener('click', () => this.handleAddItem('liability-credit-card'));
        
        const listsContainer = document.querySelector('main');
        listsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) this.handleRemoveItem(e.target.dataset.list, Number(e.target.dataset.index));
        });
        listsContainer.addEventListener('input', (e) => {
            const { list, index, prop } = e.target.dataset;
            if (list && index && prop) this.handleInputChange(list, Number(index), prop, e.target.value);
        });
        this.DOMElements.savingsGoalInput.addEventListener('input', () => this.calculateTotals());
    },

    handleAuthStateChange(user) {
        if (user) {
            this.DOMElements.loginView.classList.add('hidden');
            this.DOMElements.appView.classList.remove('hidden');
            if (user.isAnonymous) {
                this.DOMElements.userDisplay.textContent = 'Sesión Invitada';
                this.DOMElements.logoutBtn.classList.add('hidden');
                this.DOMElements.loginForAnonBtn.classList.remove('hidden');
            } else {
                this.DOMElements.userDisplay.textContent = user.displayName || user.email;
                this.DOMElements.logoutBtn.classList.remove('hidden');
                this.DOMElements.loginForAnonBtn.classList.add('hidden');
            }
            dataService.loadBudgets(this.renderSavedBudgets.bind(this));
        } else {
            this.DOMElements.appView.classList.add('hidden');
            this.DOMElements.loginView.classList.remove('hidden');
            this.DOMElements.authError.classList.add('hidden');
            this.resetForm();
        }
    },
    
    async handleAuthAction(authFunction) {
        this.DOMElements.authError.classList.add('hidden');
        try {
            await authFunction();
        } catch (error) {
            console.error("Authentication Error:", error);
            let errorMessage = 'Hubo un error al autenticar.';
            if (error.code) {
                switch (error.code) {
                    case 'auth/unauthorized-domain': errorMessage = 'Dominio no autorizado.'; break;
                    case 'auth/credential-already-in-use': errorMessage = 'Esa cuenta ya está en uso.'; break;
                    case 'auth/popup-closed-by-user': errorMessage = 'Ventana de inicio de sesión cerrada.'; break;
                }
            }
            this.DOMElements.authError.textContent = errorMessage;
            this.DOMElements.authError.classList.remove('hidden');
        }
    },

    resetForm() {
        this.assets = [ { id: Date.now() + 1, name: 'Nequi', amount: 0 }, { id: Date.now() + 2, name: 'Uala', amount: 0 }, { id: Date.now() + 3, name: 'Davivienda', amount: 0 }, { id: Date.now() + 4, name: 'Efectivo', amount: 0 } ];
        this.owed = [ { id: Date.now() + 5, name: 'Me deben', amount: 0 } ];
        this.liabilities = [ { id: Date.now() + 6, name: 'Tarjeta de Crédito N', type: 'credit-card', total: 0, minimum: 0 }, { id: Date.now() + 7, name: 'Tarjeta de Crédito V', type: 'credit-card', total: 0, minimum: 0 }, { id: Date.now() + 8, name: 'Moto', type: 'standard', amount: 0 }, { id: Date.now() + 9, name: 'Arriendo', type: 'standard', amount: 0 }, { id: Date.now() + 10, name: 'Servicios', type: 'standard', amount: 0 }, { id: Date.now() + 11, name: 'Mercado', type: 'standard', amount: 0 } ];
        this.DOMElements.monthNameInput.value = '';
        this.DOMElements.savingsGoalInput.value = 0;
        this.render();
    },

    formatCurrency: (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value),

    render() {
        const renderList = (list, element) => {
            element.innerHTML = '';
            list.forEach((item, index) => element.appendChild(this.createItemRow(item, element.id.split('-')[0], index)));
        };
        renderList(this.assets, this.DOMElements.assetsList);
        renderList(this.owed, this.DOMElements.owedList);
        renderList(this.liabilities, this.DOMElements.liabilitiesList);
        this.calculateTotals();
    },

    createItemRow(item, listType, index) {
        const listName = listType;
         if (listName === 'liabilities' && item.type === 'credit-card') {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex flex-col gap-2 p-2 border border-gray-700 rounded-md bg-gray-800';
            itemDiv.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="text" value="${item.name}" placeholder="Nombre Tarjeta" class="input-field w-full rounded-md p-2 font-semibold" data-index="${index}" data-list="${listName}" data-prop="name">
                    <button class="btn-remove flex-shrink-0" data-index="${index}" data-list="${listName}">-</button>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pl-2">
                    <div class="w-full flex-1 flex items-center gap-2"><label class="text-sm text-gray-400 whitespace-nowrap">P. Total:</label><input type="number" value="${item.total}" placeholder="Total" class="input-field w-full rounded-md p-2 text-right" data-index="${index}" data-list="${listName}" data-prop="total"></div>
                    <div class="w-full flex-1 flex items-center gap-2"><label class="text-sm text-gray-400 whitespace-nowrap">P. Mínimo:</label><input type="number" value="${item.minimum}" placeholder="Mínimo" class="input-field w-full rounded-md p-2 text-right" data-index="${index}" data-list="${listName}" data-prop="minimum"></div>
                </div>`;
            return itemDiv;
        }
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-2';
        itemDiv.innerHTML = `<input type="text" value="${item.name}" placeholder="Nombre" class="input-field w-1/2 rounded-md p-2" data-index="${index}" data-list="${listName}" data-prop="name"><input type="number" value="${item.amount}" placeholder="Monto" class="input-field w-1/2 rounded-md p-2 text-right" data-index="${index}" data-list="${listName}" data-prop="amount"><button class="btn-remove" data-index="${index}" data-list="${listName}">-</button>`;
        return itemDiv;
    },

    calculateTotals() {
        const totalAssets = [...this.assets, ...this.owed].reduce((sum, item) => sum + Number(item.amount), 0);
        const totalLiabilities = this.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.total) : sum + Number(item.amount)), 0);
        const partialLiabilities = this.liabilities.reduce((sum, item) => (item.type === 'credit-card' ? sum + Number(item.minimum) : sum + Number(item.amount)), 0);
        const netWorth = totalAssets - totalLiabilities;
        this.DOMElements.totalAssets.textContent = this.formatCurrency(totalAssets);
        this.DOMElements.totalLiabilities.textContent = this.formatCurrency(totalLiabilities);
        this.DOMElements.partialNetWorth.textContent = this.formatCurrency(totalAssets - partialLiabilities);
        this.DOMElements.netWorth.textContent = this.formatCurrency(netWorth);
        this.DOMElements.netWorth.style.color = netWorth >= 0 ? '#22C55E' : '#EF4444';
        
        const savingsGoal = Number(this.DOMElements.savingsGoalInput.value) || 0;
        const currentSavings = netWorth > 0 ? netWorth : 0;
        const progress = savingsGoal > 0 ? Math.min((currentSavings / savingsGoal) * 100, 100) : 0;
        this.DOMElements.savingsProgressBar.style.width = `${progress}%`;
        this.DOMElements.savingsProgressPercent.textContent = `${Math.floor(progress)}%`;
        this.DOMElements.savingsProgressText.textContent = `${this.formatCurrency(currentSavings)} / ${this.formatCurrency(savingsGoal)}`;
        if (progress < 40) this.DOMElements.savingsProgressBar.style.backgroundColor = '#EF4444';
        else if (progress < 75) this.DOMElements.savingsProgressBar.style.backgroundColor = '#F59E0B';
        else this.DOMElements.savingsProgressBar.style.backgroundColor = '#22C55E';
    },

    handleAddItem(itemType) {
        if (itemType === 'asset') this.assets.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'owed') this.owed.push({ id: Date.now(), name: '', amount: 0 });
        else if (itemType === 'liability-standard') this.liabilities.push({ id: Date.now(), name: '', type: 'standard', amount: 0 });
        else if (itemType === 'liability-credit-card') this.liabilities.push({ id: Date.now(), name: 'Nueva Tarjeta', type: 'credit-card', total: 0, minimum: 0 });
        this.render();
    },

    handleRemoveItem(listType, index) {
        if (listType === 'assets') this.assets.splice(index, 1);
        if (listType === 'owed') this.owed.splice(index, 1);
        if (listType === 'liabilities') this.liabilities.splice(index, 1);
        this.render();
    },

    handleInputChange(listType, index, prop, value) {
        let list = this[listType];
        if (list && list[index]) {
            if (prop === 'amount' || prop === 'total' || prop === 'minimum') list[index][prop] = Number(value);
            else list[index][prop] = value;
            this.calculateTotals();
        }
    },
    
    async saveBudget() {
        const monthName = this.DOMElements.monthNameInput.value.trim();
        if (!monthName) { alert('Por favor, ingresa un nombre para el mes.'); return; }
        const netWorth = [...this.assets, ...this.owed].reduce((s, i) => s + i.amount, 0) - this.liabilities.reduce((s, i) => s + (i.total || i.amount), 0);
        const budgetData = {
            monthName, assets: this.assets, owed: this.owed, liabilities: this.liabilities,
            savingsGoal: Number(this.DOMElements.savingsGoalInput.value) || 0,
            netWorth,
            createdAt: new Date().toISOString(),
            authorId: dataService.userId
        };
        
        try {
            await dataService.saveBudget(budgetData);
            const feedbackMsg = dataService.isAnonymousUser ? '¡Guardado Localmente!' : '¡Guardado!';
            this.DOMElements.saveBudgetBtn.textContent = feedbackMsg;
            setTimeout(() => { this.DOMElements.saveBudgetBtn.textContent = 'Guardar Mes'; }, 2000);
            if (dataService.isAnonymousUser) dataService.loadBudgets(this.renderSavedBudgets.bind(this));
        } catch (error) {
            alert(`Hubo un error al guardar: ${error.message}`);
        }
    },

    renderSavedBudgets(docs, errorMsg = null) {
        this.DOMElements.noBudgetsMsg.style.display = 'none';
        this.DOMElements.savedBudgetsList.innerHTML = '';
        if (errorMsg) {
            this.DOMElements.noBudgetsMsg.textContent = errorMsg;
            this.DOMElements.noBudgetsMsg.style.display = 'block';
            return;
        }
        if (docs.length === 0) {
            this.DOMElements.noBudgetsMsg.textContent = "Aún no has guardado ningún presupuesto.";
            this.DOMElements.noBudgetsMsg.style.display = 'block';
            return;
        }
        docs.forEach(doc => {
            const budget = doc.data();
            const budgetCard = document.createElement('div');
            budgetCard.className = 'card relative cursor-pointer transform hover:scale-105 transition-transform duration-200';
            const netWorth = budget.netWorth || 0;
            budgetCard.innerHTML = `<button class="btn-remove btn-delete-month absolute top-3 right-3 w-6 h-6 text-xs z-10" data-doc-id="${doc.id}">X</button><h3 class="text-xl font-bold text-white mb-2">${budget.monthName}</h3><p>Total: <span class="${netWorth >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${this.formatCurrency(netWorth)}</span></p><p class="text-xs text-gray-500 mt-2">Guardado: ${new Date(budget.createdAt).toLocaleDateString()}</p>`;
            budgetCard.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete-month')) {
                    e.stopPropagation();
                    dataService.deleteBudget(e.target.dataset.docId);
                     if (dataService.isAnonymousUser) dataService.loadBudgets(this.renderSavedBudgets.bind(this));
                } else {
                    this.DOMElements.monthNameInput.value = budget.monthName;
                    this.DOMElements.savingsGoalInput.value = budget.savingsGoal || 0;
                    this.assets = structuredClone(budget.assets || []);
                    this.owed = structuredClone(budget.owed || []);
                    this.liabilities = structuredClone(budget.liabilities || []).map(i => ({...i}));
                    this.render();
                }
            });
            this.DOMElements.savedBudgetsList.appendChild(budgetCard);
        });
    },

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

// --- 3. PUNTO DE ENTRADA DE LA APLICACIÓN ---
appController.init();