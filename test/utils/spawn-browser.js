const puppeteer = require('puppeteer')
const http = require('http')
require('http-shutdown').extend()

class Browser {

  constructor(options) {
    this.browser = null
    this.server = null
    this.port = options.port || 8080
    this.routes = options.routes || []
  }

  _createServer() {
    const reqHandler = (req, res) => {
      let didEnd = false
      this.routes.some(route => {
        if (!route.test || route.test.test(req.url)) {
          res.writeHead(200)
          res.end(route.file)
          return (didEnd = true)
        }
        return false
      })
      if (!didEnd) {
        res.writeHead(404)
        res.end('Not Found')
      }
    }

    const server = http.createServer(reqHandler).withShutdown()
    server.listen(this.port)
    return server
  }

  async getBrowser() {
    let browser;

    if (!this.server) {
      this.server = this._createServer()
    }

    if (!this.browser) {
      browser = await puppeteer.launch()
    }

    // If we had a race condition on two processes creating a browser,
    // close the one we don't need
    if (browser && this.browser) {
      await browser.close()

    // If this was the first process to finish, set the browser
    } else if (!this.browser) {
      this.browser = browser
    }

    return this.browser
  }

  async _getRawPage() {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    return page
  }

  async closeBrowser() {
    const browser = await this.getBrowser()
    const pages = await browser.pages()
    await Promise.all(pages.map(async page => await page.close()))
    await browser.close()
    this.server && this.server.shutdown()
    this.server = null
  }

  async getPage() {
    const page = await this._getRawPage()
    await page.goto(`http://localhost:${this.port}`, {waitUntil: `networkidle0`})
    return page
  }
}

module.exports = Browser
