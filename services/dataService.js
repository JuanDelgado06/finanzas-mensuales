export function createDataService(controller) {
  return {
    async getMongoAuthHeaders() {
      const { user } = controller.state;
      if (!user || user.isAnonymous) {
        throw new Error('Usuario no autenticado para acceso en la nube.');
      }

      const idToken = await user.getIdToken();
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
    },

    async parseApiError(response) {
      try {
        const payload = await response.json();
        const reason = payload?.reason ? ` (${payload.reason})` : '';
        return `${response.status}${reason}`;
      } catch {
        return `${response.status}`;
      }
    },

    async saveBudget(budgetData) {
      const { isAnonymous, user } = controller.state;
      const monthName = budgetData.monthName;

      if (isAnonymous) {
        try {
          let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
          const existingIndex = budgets.findIndex((b) => b.monthName === monthName);
          if (existingIndex > -1) budgets[existingIndex] = budgetData;
          else budgets.push(budgetData);
          localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
          return true;
        } catch (error) {
          console.error('Error saving to localStorage:', error);
          return false;
        }
      } else if (user) {
        try {
          const headers = await this.getMongoAuthHeaders();
          const response = await fetch('/api/budgets', {
            method: 'POST',
            headers,
            body: JSON.stringify(budgetData),
          });

          if (!response.ok) {
            const errorDetail = await this.parseApiError(response);
            throw new Error(`Error guardando presupuesto: ${errorDetail}`);
          }
          return true;
        } catch (error) {
          console.error('Error saving to MongoDB:', error);
          return false;
        }
      }
      return false;
    },

    async deleteBudget(docId) {
      const { isAnonymous, user } = controller.state;
      if (isAnonymous) {
        try {
          let budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
          const monthName = docId.replace(/-/g, ' ');
          budgets = budgets.filter((b) => b.monthName !== monthName);
          localStorage.setItem('anonymousBudgets', JSON.stringify(budgets));
          this.loadBudgets();
        } catch (error) {
          console.error('Error deleting from localStorage:', error);
        }
      } else if (user) {
        try {
          const headers = await this.getMongoAuthHeaders();
          const response = await fetch(`/api/budgets?monthSlug=${encodeURIComponent(docId)}`, {
            method: 'DELETE',
            headers,
          });

          if (!response.ok) {
            const errorDetail = await this.parseApiError(response);
            throw new Error(`Error eliminando presupuesto: ${errorDetail}`);
          }

          await this.loadBudgets();
        } catch (error) {
          console.error('Error deleting from MongoDB:', error);
        }
      }
    },

    async loadBudgets() {
      const { isAnonymous, user } = controller.state;
      if (isAnonymous) {
        const budgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];
        const docs = budgets.map((b) => ({ id: b.monthName.replace(/ /g, '-'), data: () => b }));
        controller.renderSavedBudgets(docs);
      } else if (user) {
        try {
          const headers = await this.getMongoAuthHeaders();
          const response = await fetch('/api/budgets', {
            method: 'GET',
            headers,
          });

          if (!response.ok) {
            const errorDetail = await this.parseApiError(response);
            throw new Error(`Error cargando presupuestos: ${errorDetail}`);
          }

          const payload = await response.json();
          const budgets = payload.budgets || [];
          const docs = budgets.map((budget) => ({
            id: budget.monthSlug || budget.monthName.replace(/ /g, '-'),
            data: () => budget,
          }));
          controller.renderSavedBudgets(docs);
        } catch (error) {
          console.error('Error loading budgets from MongoDB:', error);
          controller.DOMElements.noBudgetsMsg.textContent = 'Error al cargar datos en la nube.';
          controller.DOMElements.noBudgetsMsg.style.display = 'block';
        }
      }
    },

    async migrateLocalDataToMongo() {
      const localBudgets = JSON.parse(localStorage.getItem('anonymousBudgets')) || [];

      try {
        for (const budget of localBudgets) {
          await this.saveBudget(budget);
        }

        console.log('Local data successfully migrated to MongoDB.');
        localStorage.removeItem('anonymousBudgets');
        localStorage.removeItem('anonymousConfig');
      } catch (error) {
        console.error('Error migrating data:', error);
        alert('Hubo un error al mover tus datos locales a tu cuenta.');
      }
    },
  };
}
