const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3002',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    // Configuración específica para CI/CD
    retries: {
      runMode: 2,
      openMode: 0
    },
    setupNodeEvents(on, config) {
      // Configuración para CI/CD
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        // Tarea para limpiar simulaciones de prueba
        cleanupSimulations() {
          return cy.cleanupTestSimulations()
        }
      })
    },
  },
  env: {
    API_BASE_URL: 'http://localhost:5002',
    SIMULATION_TIMEOUT: 600000, // 10 minutos para CI/CD
    POLL_INTERVAL: 10000, // 10 segundos entre verificaciones
    CI: true
  }
})
