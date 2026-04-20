export function createChartMethods(controller) {
  return {
    updateCharts() {
      console.log('Updating charts...');
      console.log('Chart.js available:', typeof Chart);
      this.drawAssetsChart();
      this.drawLiabilitiesChart();
      this.drawMicroExpensesChart();
      this.drawComparisonChart();
    },

    drawAssetsChart() {
      const ctx = controller.DOMElements.assetsChart;
      console.log('Assets chart canvas:', ctx);
      if (!ctx) {
        console.error('Assets chart canvas not found');
        return;
      }

      if (controller.state.charts.assets) {
        controller.state.charts.assets.destroy();
      }

      console.log('Creating assets chart...');
      const assetsData = controller.state.assets.filter((item) => item.amount > 0);
      const owedData = controller.state.owed.filter((item) => item.amount > 0);

      const data = {
        labels: [...assetsData.map((item) => item.name), ...owedData.map((item) => item.name)],
        datasets: [
          {
            data: [...assetsData.map((item) => item.amount), ...owedData.map((item) => item.amount)],
            backgroundColor: [
              '#10B981', '#34D399', '#6EE7B7', '#A7F3D0',
              '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE',
            ],
            borderWidth: 2,
            borderColor: '#1F2937',
          },
        ],
      };

      try {
        controller.state.charts.assets = new Chart(ctx, {
          type: 'doughnut',
          data,
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#F3F4F6',
                  font: { size: 12 },
                },
              },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.label}: ${controller.formatCurrency(context.parsed)}`,
                },
              },
            },
          },
        });
        console.log('Assets chart created successfully');
      } catch (error) {
        console.error('Error creating assets chart:', error);
      }
    },

    drawLiabilitiesChart() {
      const ctx = controller.DOMElements.liabilitiesChart;
      if (!ctx) return;

      if (controller.state.charts.liabilities) {
        controller.state.charts.liabilities.destroy();
      }

      const liabilitiesData = controller.state.liabilities.filter((item) => {
        if (item.type === 'credit-card') return item.total > 0;
        return item.amount > 0;
      });

      const data = {
        labels: liabilitiesData.map((item) => item.name),
        datasets: [
          {
            data: liabilitiesData.map((item) => (item.type === 'credit-card' ? item.total : item.amount)),
            backgroundColor: [
              '#EF4444', '#F87171', '#FCA5A5', '#FECACA',
              '#F97316', '#FB923C', '#FDBA74', '#FED7AA',
            ],
            borderWidth: 2,
            borderColor: '#1F2937',
          },
        ],
      };

      controller.state.charts.liabilities = new Chart(ctx, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#F3F4F6',
                font: { size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${controller.formatCurrency(context.parsed)}`,
              },
            },
          },
        },
      });
    },

    drawMicroExpensesChart() {
      const ctx = controller.DOMElements.microExpensesChart;
      if (!ctx) return;

      if (controller.state.charts.microExpenses) {
        controller.state.charts.microExpenses.destroy();
      }

      const microExpensesData = controller.state.microExpenses.filter((item) => item.amount > 0);
      const expenseTotals = {};
      microExpensesData.forEach((expense) => {
        const name = expense.name || 'Sin Nombre';
        expenseTotals[name] = (expenseTotals[name] || 0) + Number(expense.amount);
      });

      const data = {
        labels: Object.keys(expenseTotals),
        datasets: [
          {
            data: Object.values(expenseTotals),
            backgroundColor: [
              '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A',
              '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE',
              '#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8',
            ],
            borderWidth: 2,
            borderColor: '#1F2937',
          },
        ],
      };

      controller.state.charts.microExpenses = new Chart(ctx, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#F3F4F6',
                font: { size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${controller.formatCurrency(context.parsed)}`,
              },
            },
          },
        },
      });
    },

    drawComparisonChart() {
      const ctx = controller.DOMElements.comparisonChart;
      if (!ctx) return;

      if (controller.state.charts.comparison) {
        controller.state.charts.comparison.destroy();
      }

      const totalAssets = controller.state.assets.concat(controller.state.owed).reduce((sum, item) => sum + Number(item.amount), 0);
      const totalLiabilities = controller.state.liabilities.reduce((sum, item) => {
        if (item.type === 'credit-card') return sum + Number(item.total);
        return sum + Number(item.amount);
      }, 0);

      const data = {
        labels: ['Activos', 'Deudas'],
        datasets: [
          {
            label: 'Monto',
            data: [totalAssets, totalLiabilities],
            backgroundColor: ['#10B981', '#EF4444'],
            borderColor: ['#059669', '#DC2626'],
            borderWidth: 2,
          },
        ],
      };

      controller.state.charts.comparison = new Chart(ctx, {
        type: 'bar',
        data,
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: '#F3F4F6',
                callback: (value) => controller.formatCurrency(value),
              },
              grid: {
                color: '#374151',
              },
            },
            x: {
              ticks: {
                color: '#F3F4F6',
              },
              grid: {
                color: '#374151',
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `${context.label}: ${controller.formatCurrency(context.parsed.y)}`,
              },
            },
          },
        },
      });
    },
  };
}
