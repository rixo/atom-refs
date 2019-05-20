const css = s => s

module.exports = ({ legacyTestRunner, ...args }) => {
  const style = document.createElement('style')
  style.innerText = css`
    body .spec-reporter .result-message.fail {
      font-family: monospace;
    }
    body .spec-reporter-container {
      position: static;
    }
  `
  document.head.appendChild(style)
  return legacyTestRunner(args)
}
