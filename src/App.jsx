// src/App.jsx
import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import analyzeComplexity from './ComplexityAnalyzer';
import './index.css';

const SAMPLE_JS = `// Example 1: O(n)
function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    s += arr[i];
  }
  return s;
}`

const SAMPLE_JS_NESTED = `// Example 2: O(n^2)
function pairs(arr) {
  let out = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      out.push([arr[i], arr[j]]);
    }
  }
  return out;
}`

const SAMPLE_JS_LOG = `// Example 3: O(log n)
function halves(n) {
  while (n > 1) {
    n = Math.floor(n / 2);
  }
}`

const SAMPLE_JS_RECUR = `// Example 4: O(2^n) naive fibonacci (exponential)
function fib(n) {
  if (n <= 1) return n;
  return fib(n-1) + fib(n-2);
}`

export default function App() {
  const [code, setCode] = useState(SAMPLE_JS);
  const [result, setResult] = useState(null);
  const [language, setLanguage] = useState('javascript');

  function handleCalculate() {
    const res = analyzeComplexity(code);
    setResult(res);
  }

  function loadSample(n) {
    if (n === 1) setCode(SAMPLE_JS);
    if (n === 2) setCode(SAMPLE_JS_NESTED);
    if (n === 3) setCode(SAMPLE_JS_LOG);
    if (n === 4) setCode(SAMPLE_JS_RECUR);
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Code Complexity Analyzer</h1>
        <div className="header-actions">
          <select className='option' value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C / C++ / Java</option>
          </select>
          <button onClick={handleCalculate} className="btn-primary">Analyze Complexity</button>
        </div>
      </header>

      <main className="main-grid">
        <section className="editor-pane">
          <div className="editor-toolbar">
            <span><h2>Editor</h2></span>
            <div className="sample-buttons">
              <button onClick={() => loadSample(1)}>Sample: O(n)</button>
              <button onClick={() => loadSample(2)}>Sample: O(n^2)</button>
              <button onClick={() => loadSample(3)}>Sample: O(log n)</button>
              <button onClick={() => loadSample(4)}>Sample: O(2^n)</button>
            </div>
          </div>

          <Editor
            height="60vh"
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={(val) => setCode(val || '')}
            theme="vs-light"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              automaticLayout: true,
              lineNumbers: 'on'
            }}
          />
        </section>

        <aside className="result-pane">
          <h2>Results</h2>
          {result ? (
            <div className="results">
              <p><strong>Time Complexity:</strong> <code>{result.time}</code></p>
              <p>{result.timeExplanation}</p>

              <p style={{ marginTop: 16 }}><strong>Space Complexity:</strong> <code>{result.space}</code></p>
              <p>{result.spaceExplanation}</p>
            </div>
          ) : (
            <p>Paste code in the editor and click <em>Calculate Complexity</em>.</p>
          )}
        </aside>
      </main>
    </div>
  );
}
