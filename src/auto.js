(() => {
  function loadCSS (item) {
    if (item === undefined || item === null) { return }

    let url = null
    let loaded = null
    if (typeof item === 'object') {
      url = item.url
      loaded = item.loaded
    } else if (typeof item === 'string') {
      url = item
    }
    let newCSS = document.createElement('link')
    newCSS.rel = 'stylesheet'
    newCSS.type = 'text/css'
    newCSS.href = url
    newCSS.media = 'all'
    newCSS.onload = () => {
      console.log('Loaded:', url)
      if (loaded) {
        loaded()
      }
    }
    document.head.appendChild(newCSS)
  }

  /**
   * Dynamically load a list JS files sequentially.
   *
   * @param {(string|Object)[]} aList The list of JS files to load
   * @param {string} aList[].url The url of the JS file to load
   * @param {function} aList[].loaded Callback when the file is loaded
   * @param {function} aList[].shouldSkip Check before loading the file.
   *  Note: if `loaded` is set, it will be called no matter this loading is skiped or not.
   *        Skipping loading means only to skip the loading part.
   *
   * @param {function} finished Callback when all files loaded
   *
   * Example:
   *  1. `loadJSSequentially([
   *        'https://unpkg.com/vue',
   *        'https://unpkg.com/vuefire'
   *      ], () => {
   *        console.log('Finished loading!')
   *      })`
   *  2. `loadJSSequentially([
   *        {
   *          url: 'https://unpkg.com/vue',
   *          shouldSkip: () => window.Vue !== undefined,
   *          loaded: () => { console.log('Loaded Vue!') }
   *        },
   *        'https://unpkg.com/vuefire'
   *      ], () => {
   *        console.log('Finished loading!')
   *      })`
   */
  function loadJSSequentially (aList, finished) {
    if (aList.length === 0) {
      console.log('Finished loadJSSequentially.')
      if (finished) {
        finished()
      }
      return
    }
    let item = aList.shift()

    let newScript = document.createElement('script')

    let url = null
    let shouldSkip = null
    let loaded = null

    if (typeof item === 'object') {
      ({ url, shouldSkip, loaded } = item)
      if (shouldSkip()) {
        console.log('Skipped loading', url)
        console.timeEnd(`\tLoading time of "${url}"\n\t`)
        if (loaded) {
          loaded()
        }
        loadJSSequentially(aList, finished)
      } else {
        newScript.onload = () => {
          console.log('Loaded:', url)
          console.timeEnd(`\tLoading time of "${url}"\n\t`)
          if (loaded) {
            loaded()
          }
          loadJSSequentially(aList, finished)
        }
      }
    } else if (typeof item === 'string') {
      url = item
      newScript.onload = () => {
        console.log('Loaded:', url)
        console.timeEnd(`\tLoading time of "${url}"\n\t`)
        loadJSSequentially(aList, finished)
      }
    }
    newScript.src = url
    document.head.appendChild(newScript)
    console.time(`\tLoading time of "${url}"\n\t`)
  }

  // Custom `Exception`
  function WfException (message) {
    this.message = message
    this.toString = () => {
      return this.message
    }
  }

  // Custom translator to replace `i18next`
  function WfI18n (translation = {}, fallback = null, locale = 'en') {
    this.translation = translation
    this.locale = locale
    this.fallback = fallback

    this.t = (key) => {
      let result = this.translation[this.locale]
      if (!result) { result = this.translation[this.fallback] }
      if (!result) { throw new WfException(`Translation for locale "${this.locale}" not found.`) }
      const keys = key.split('.')
      if (keys.length === 0) { throw new WfException('Empty translation key.') }
      for (let i = 0; i < keys.length; i++) {
        result = result[keys[i]]
        if (!result) {
          setTimeout(() => {
            throw new WfException(`Translation for key "${key}" not found.`)
          })
          return key
        }
      }
      return result
    }
    return {
      t: this.t
    }
  }

  function startWildfire () {
    console.log('Starting Wildfire...')
    loadCSS(`https://unpkg.com/wildfire/dist/${databaseProvider}/static/wildfire.css`)
    let jsList = []
    if (!window.Vue) { jsList.push('https://unpkg.com/vue') }
    jsList.push(databaseProvider === 'firebase' ? 'https://www.gstatic.com/firebasejs/4.6.2/firebase.js' : 'https://cdn.wilddog.com/sdk/js/2.5.17/wilddog.js')
    jsList.push(`https://unpkg.com/wildfire/dist/${databaseProvider}/wildfire.min.js`)

    loadJSSequentially(jsList, () => {
      window.wildfire.default.install(window.Vue, {
        databaseProvider,
        databaseConfig,
        pageURL,
        pageTitle,
        theme,
        locale,
        defaultAvatarURL
      })

      /* eslint-disable no-new */
      new window.Vue({ el: '#wildfire' })
    })
  }

  function initDom () {
    const initialCSS = `.wildfire_thread{font-family:'Helvetica Neue',arial,sans-serif;width: 100%;margin:0 auto}[v-cloak]{display:none}#wf-loading-modal{font-size:12px;display:flex;flex-direction:column;height:300px;color:#656c7a;justify-content:center;align-items:center}#wf-loading-modal img{width:66px;height:66px}@keyframes flickerAnimation{0%{opacity:1}40%{opacity:0}100%{opacity:1}}@-o-keyframes flickerAnimation{0%{opacity:1}40%{opacity:0}100%{opacity:1}}@-moz-keyframes flickerAnimation{0%{opacity:1}40%{opacity:0}100%{opacity:1}}@-webkit-keyframes flickerAnimation{0%{opacity:1}40%{opacity:0}100%{opacity:1}}.animate-flicker{-webkit-animation:flickerAnimation 1.5s infinite;-moz-animation:flickerAnimation 1.5s infinite;-o-animation:flickerAnimation 1.5s infinite;animation:flickerAnimation 1.5s infinite}`
    let initialStyle = document.createElement('style')
    initialStyle.type = 'text/css'
    if (initialStyle.styleSheet) {
      initialStyle.styleSheet.cssText = initialCSS
    } else {
      initialStyle.appendChild(document.createTextNode(initialCSS))
    }
    document.head.appendChild(initialStyle)

    // Insert template
    let wildfireThreadDom = document.getElementsByClassName('wildfire_thread')[0]
    wildfireThreadDom.innerHTML = `
      <div id="wf-loading-modal" class="wf wf-theme-${theme} animate-flicker">
        <img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgd2lkdGg9IjI1NnB4IiBoZWlnaHQ9IjM1MXB4IiB2aWV3Qm94PSIwIDAgMjU2IDM1MSIgdmVyc2lvbj0iMS4xIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCI+DQogIDxkZWZzPg0KICAgIDxwYXRoIGQ9Ik0xLjI1MjczNDM3IDI4MC43MzE2NDFMMi44NTgzNDUzMyAyNzcuNjAwODU4IDEwMi4yMTExNzcgODkuMDgzMzU0NiA1OC4wNjEzMjY2IDUuNjA4MjAzM0M1NC4zOTIwMDExLTEuMjgzMDQ1NzggNDUuMDc0MTI0NSAwLjQ3MzY3NDM5OCA0My44Njk5MjAzIDguMTg3ODkwODZMMS4yNTI3MzQzNyAyODAuNzMxNjQxWiIgaWQ9InBhdGgtMSIgLz4NCiAgICA8ZmlsdGVyIHg9Ii01MCUiIHk9Ii01MCUiIHdpZHRoPSIyMDAlIiBoZWlnaHQ9IjIwMCUiIGZpbHRlclVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCIgaWQ9ImZpbHRlci0yIj4NCiAgICAgIDxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjE3LjUiIGluPSJTb3VyY2VBbHBoYSIgcmVzdWx0PSJzaGFkb3dCbHVySW5uZXIxIiAvPg0KICAgICAgPGZlT2Zmc2V0IGR4PSIwIiBkeT0iMCIgaW49InNoYWRvd0JsdXJJbm5lcjEiIHJlc3VsdD0ic2hhZG93T2Zmc2V0SW5uZXIxIiAvPg0KICAgICAgPGZlQ29tcG9zaXRlIGluPSJzaGFkb3dPZmZzZXRJbm5lcjEiIGluMj0iU291cmNlQWxwaGEiIG9wZXJhdG9yPSJhcml0aG1ldGljIiBrMj0iLTEiIGszPSIxIiByZXN1bHQ9InNoYWRvd0lubmVySW5uZXIxIiAvPg0KICAgICAgPGZlQ29sb3JNYXRyaXggdmFsdWVzPSIwIDAgMCAwIDAgICAwIDAgMCAwIDAgICAwIDAgMCAwIDAgIDAgMCAwIDAuMDYgMCIgdHlwZT0ibWF0cml4IiBpbj0ic2hhZG93SW5uZXJJbm5lcjEiIC8+DQogICAgPC9maWx0ZXI+DQogICAgPHBhdGggZD0iTTEzNC40MTcxMDMgMTQ4Ljk3NDIzNUwxNjYuNDU1NzIyIDExNi4xNjE3MzggMTM0LjQxNzEwNCA1NS4xNTQ2ODc0QzEzMS4zNzQ4MjggNDkuMzYzNTkxMSAxMjMuOTgzOTExIDQ4Ljc1NjgzNjIgMTIwLjk3MzgyOCA1NC41NjQ2NDgzTDEwMy4yNjg3NSA4OC42NzM4Mjk2IDEwMi43Mzk0MjMgOTAuNDE3NTQ3MyAxMzQuNDE3MTAzIDE0OC45NzQyMzVaIiBpZD0icGF0aC0zIiAvPg0KICAgIDxmaWx0ZXIgeD0iLTUwJSIgeT0iLTUwJSIgd2lkdGg9IjIwMCUiIGhlaWdodD0iMjAwJSIgZmlsdGVyVW5pdHM9Im9iamVjdEJvdW5kaW5nQm94IiBpZD0iZmlsdGVyLTQiPg0KICAgICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMy41IiBpbj0iU291cmNlQWxwaGEiIHJlc3VsdD0ic2hhZG93Qmx1cklubmVyMSIgLz4NCiAgICAgIDxmZU9mZnNldCBkeD0iMSIgZHk9Ii05IiBpbj0ic2hhZG93Qmx1cklubmVyMSIgcmVzdWx0PSJzaGFkb3dPZmZzZXRJbm5lcjEiIC8+DQogICAgICA8ZmVDb21wb3NpdGUgaW49InNoYWRvd09mZnNldElubmVyMSIgaW4yPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImFyaXRobWV0aWMiIGsyPSItMSIgazM9IjEiIHJlc3VsdD0ic2hhZG93SW5uZXJJbm5lcjEiIC8+DQogICAgICA8ZmVDb2xvck1hdHJpeCB2YWx1ZXM9IjAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgIDAgMCAwIDAgMCAgMCAwIDAgMC4wOSAwIiB0eXBlPSJtYXRyaXgiIGluPSJzaGFkb3dJbm5lcklubmVyMSIgLz4NCiAgICA8L2ZpbHRlcj4NCiAgPC9kZWZzPg0KICA8cGF0aCBkPSJNMCAyODIuOTk3NjJMMi4xMjI1MDc0NiAyODAuMDI1NiAxMDIuNTI3MzYzIDg5LjUxMTkyODQgMTAyLjczOTQyMyA4Ny40OTUxMzIzIDU4LjQ3ODgwNiA0LjM1ODE3NzExQzU0Ljc3MDYyNjktMi42MDYwNDE3OSA0NC4zMzEzMDM1LTAuODQ1MjQ1NzcxIDQzLjExNDM0ODMgNi45NTA2NTQ3M0wwIDI4Mi45OTc2MloiIGZpbGw9IiNEQjQ1MEQiIC8+DQogIDx1c2UgZmlsbD0iI0RCNDUwRCIgZmlsbC1ydWxlPSJldmVub2RkIiB4bGluazpocmVmPSIjcGF0aC0xIiAvPg0KICA8dXNlIGZpbGw9ImJsYWNrIiBmaWxsLW9wYWNpdHk9IjEiIGZpbHRlcj0idXJsKCNmaWx0ZXItMikiIHhsaW5rOmhyZWY9IiNwYXRoLTEiIC8+DQogIDx1c2UgZmlsbD0iI0RCNDUwRCIgZmlsbC1ydWxlPSJldmVub2RkIiB4bGluazpocmVmPSIjcGF0aC0zIiAvPg0KICA8dXNlIGZpbGw9ImJsYWNrIiBmaWxsLW9wYWNpdHk9IjEiIGZpbHRlcj0idXJsKCNmaWx0ZXItNCkiIHhsaW5rOmhyZWY9IiNwYXRoLTMiIC8+DQogIDxwb2x5Z29uIGZpbGw9IiNCMTMxMDEiIHBvaW50cz0iMCAyODIuOTk3NjIgMC45NjIwOTcxNjggMjgyLjAzMDM5NiA0LjQ1NzcxMTQ0IDI4MC42MDk1NiAxMzIuOTM1MzIzIDE1Mi42MDk1NiAxMzQuNTYzMDI1IDE0OC4xNzg1OTUgMTAyLjUxMzEyMyA4Ny4xMDQ4NTg0IiAvPg0KICA8cGF0aCBkPSJNMTM5LjEyMDk3MSAzNDcuNTUxMjY4TDI1NS4zOTU5MTYgMjgyLjcwMzY2NiAyMjIuMTkxNjk4IDc4LjIwOTMzNzNDMjIxLjE1MzA1MSA3MS44MTEyNDc4IDIxMy4zMDM2NTggNjkuMjgxODE0OSAyMDguNzI0MzE0IDczLjg2OTQzNjhMMC4wMDAyNTQ3MjYzNjggMjgyLjk5Nzg3NSAxMTUuNjA4NDU0IDM0Ny41NDU1MzZDMTIyLjkxNDY0MyAzNTEuNjI0OTc5IDEzMS44MTI4NzIgMzUxLjYyNjg5IDEzOS4xMjA5NzEgMzQ3LjU1MTI2OE0yNTQuMzU0MDg0IDI4Mi4xNTk4MzdMMjIxLjQwMTkzNyA3OS4yMTc5MzY5QzIyMC4zNzExNzUgNzIuODY4NDE4OCAyMTMuODQzNzkyIDcwLjI0MDk1NTMgMjA5LjI5OTIxMyA3NC43OTM3NUwxLjI4OTQ1MzEyIDI4Mi42MDA3ODUgMTE1LjYyNzgyNSAzNDYuNTA5NDU4QzEyMi44Nzg1NDggMzUwLjU1NzkzMSAxMzEuNzA5MjI2IDM1MC41NTk4MjcgMTM4Ljk2MTg0NiAzNDYuNTE1MTQ2TDI1NC4zNTQwODQgMjgyLjE1OTgzN1oiIGZpbGw9IiNGMzZBMzgiIC8+DQo8L3N2Zz4=" title="Wildfire - Provided by Lahk">
        <span>${window._i18n.t('text.poweringWildfire')}</span>
      </div>
      <div id="wildfire" v-cloak><wildfire></wildfire></div>
      `
  }

  /*
    Configs Validation
   */
  function presentErrorMsg (errorCode) {
    const msg = window._i18n.t(errorCode)
    let wfLoadingModal = document.getElementById('wf-loading-modal')
    wfLoadingModal.className = `wf wf-theme-${theme}` // cancel flicker animation

    let msgSpan = wfLoadingModal.children[1]
    msgSpan.innerHTML = msg
    msgSpan.style.color = 'red'
  }

  function checkConfigs () {
    const wildfireThreadDom = document.getElementsByClassName('wildfire_thread')
    if (wildfireThreadDom.length === 0) {
      presentErrorMsg('error.wildfireThreadNotFound')
      return
    } else if (databaseProvider !== 'firebase' && databaseProvider !== 'wilddog') {
      presentErrorMsg('error.invalidDatabaseProvider')
      return
    } else if (!databaseConfig) {
      presentErrorMsg('error.noDatabaseConfig')
      return
    }
    startWildfire()
  }
  /*
    End of: Configs Validation
   */

  // Get configs from global configuration object
  const {
    databaseProvider,
    databaseConfig, // required
    pageTitle = document.title,
    pageURL = window.location.href,
    locale = 'en',
    theme = 'light',
    defaultAvatarURL = 'https://cdn.rawgit.com/cheng-kang/wildfire/088cf3de/resources/wildfire-avatar.svg'
  } = window.wildfireConfig()

  // Set up custom translator for loading text & error message
  window._i18n = new WfI18n({
    en: {
      error: {
        invalidDatabaseProvider: 'Please check your config: "databaseProvider" should be "firebase" or "wilddog".',
        multipleWildfireThread: '"wildfire-thread" not found, please follow the steps in documentation.',
        noDatabaseConfig: 'Please check your config: missing "databaseConfig"'
      },
      text: {
        poweringWildfire: 'Powering Wildfire...'
      }
    },
    'zh-CN': {
      error: {
        invalidDatabaseProvider: '请检查你的配置： "databaseProvider" 应该为 "firebase" 或者 "wilddog"。',
        multipleWildfireThread: '未检测到 “wildfire-thread”，请依照文档所示步骤添加。',
        noDatabaseConfig: '请检查你的配置： 找不到 "databaseConfig"'
      },
      text: {
        poweringWildfire: '正在启动 Wildfire……'
      }
    }
  }, 'en', locale)

  initDom()
  // Forcing a 1s loading animation
  setTimeout(checkConfigs, 1000)
})()
