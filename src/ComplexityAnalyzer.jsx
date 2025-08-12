function stripCommentsAndStrings(code) {
  // Remove block comments, line comments, python # comments and string literals
  code = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
  code = code.replace(/\/\/.*$/gm, ' ');
  code = code.replace(/#.*$/gm, ' ');
  code = code.replace(/(["'`])(?:\\.|(?!\1).)*\1/gm, ' ');
  return code;
}

function lower(code) {
  return String(code).toLowerCase();
}

/* -------------------------
   Known algorithm detectors
   ------------------------- */
function detectKnownAlgorithms(code) {
  const c = lower(code);
  const mention = (w) => c.includes(w);
  const results = [];

  // Sorting / Searching
  if (mention('merge sort') || /\bmergesort\b/.test(c)) results.push({ name: 'Merge Sort', time: 'O(n log n)', space: 'O(n)' });
  if (mention('quick sort') || /\bquicksort\b/.test(c)) results.push({ name: 'Quick Sort', time: 'O(n log n) average, O(n²) worst', space: 'O(log n) average' });
  if (mention('heap sort') || /\bheapsort\b/.test(c)) results.push({ name: 'Heap Sort', time: 'O(n log n)', space: 'O(1)' });
  if (mention('bubble sort')) results.push({ name: 'Bubble Sort', time: 'O(n²)', space: 'O(1)' });
  if (mention('insertion sort')) results.push({ name: 'Insertion Sort', time: 'O(n²)', space: 'O(1)' });
  if (mention('selection sort')) results.push({ name: 'Selection Sort', time: 'O(n²)', space: 'O(1)' });
  if (mention('counting sort')) results.push({ name: 'Counting Sort', time: 'O(n + k)', space: 'O(k)' });
  if (mention('radix sort')) results.push({ name: 'Radix Sort', time: 'O(nk)', space: 'O(n + k)' });

  // Searching
  if (mention('binary search') || /\bbinarysearch\b/.test(c)) results.push({ name: 'Binary Search', time: 'O(log n)', space: 'O(1)' });
  if (mention('linear search') || mention('sequential search')) results.push({ name: 'Linear Search', time: 'O(n)', space: 'O(1)' });

  // Graph algorithms
  if (/\bbfs\s*\(|\bbreadth[- ]first\b/.test(c) || (mention('queue') && (mention('visited') || mention('adj')))) results.push({ name: 'BFS', time: 'O(V + E)', space: 'O(V)' });
  if (/\bdfs\s*\(|\bdepth[- ]first\b/.test(c) || (mention('visited') && (mention('stack') || /return\s+\w+\s*\(/.test(code)))) results.push({ name: 'DFS', time: 'O(V + E)', space: 'O(V)' });
  if (mention('dijkstra')) results.push({ name: "Dijkstra's algorithm", time: 'O((V + E) log V)', space: 'O(V + E)' });
  if (/\bbellman[- ]?ford\b/.test(c) || mention('bellman ford')) results.push({ name: 'Bellman–Ford', time: 'O(V × E)', space: 'O(V)' });
  if (mention('kruskal')) results.push({ name: "Kruskal's algorithm", time: 'O(E log E)', space: 'O(V + E)' });
  if (mention('prim')) results.push({ name: "Prim's algorithm", time: 'O(E log V)', space: 'O(V + E)' });
  if (/\bfloyd[- ]?warshall\b/.test(c) || mention('floyd warshall')) results.push({ name: 'Floyd–Warshall', time: 'O(V³)', space: 'O(V²)' });

  // Dynamic programming / recursion common patterns
  if (mention('naive fibonacci') || /\bfib\(|\bfibonacci\b/.test(c)) {
    if (/\bmem|memo\b|\bcache\b|\bdp\b/.test(c)) {
      results.push({ name: 'Memoized Fibonacci (DP)', time: 'O(n)', space: 'O(n)' });
    } else {
      results.push({ name: 'Naive Recursive Fibonacci', time: 'O(2^n)', space: 'O(n)' });
    }
  }

  // MST / union-find hints
  if (/\bdisjoint\b|\bunion[- ]find\b|\bunite\b/.test(c)) {
    if (!results.some(r => r.name.toLowerCase().includes('kruskal'))) {
      results.push({ name: 'Union-Find usage', time: 'Usually O(α(n) · (E log E)) for Kruskal context', space: 'O(V)' });
    }
  }

  // Matrix / DP heavy algorithms
  if (/\bmatrix chain\b/.test(c) || /\bmatrixchain\b/.test(c)) results.push({ name: 'Matrix Chain Multiplication (DP)', time: 'O(n³)', space: 'O(n²)' });
  if (/\bknapsack\b/.test(c)) results.push({ name: 'Knapsack (DP typical)', time: 'O(nW)', space: 'O(W) or O(nW)' });

  if (results.length > 0) {
    const primary = results[0];
    return {
      time: primary.time,
      timeExplanation: `Detected known algorithm or strong hint: ${primary.name}.`,
      space: primary.space,
      spaceExplanation: primary.space,
      details: { matches: results.map(r => r.name) }
    };
  }
  return null;
}

/* -------------------------
   Structural / heuristic analysis
   ------------------------- */

function detectLoopsAndNesting(code) {
  const loops = [];
  const forRegex = /for\s*\(([^)]*)\)/g;
  const whileRegex = /while\s*\(([^)]*)\)/g;
  const rangeForRegex = /for\s*\([\w\s,]*:\s*[^)]*\)/g;
  let m;

  while ((m = forRegex.exec(code)) !== null) loops.push({ type: 'for', header: m[1], pos: m.index });
  while ((m = whileRegex.exec(code)) !== null) loops.push({ type: 'while', header: m[1], pos: m.index });
  while ((m = rangeForRegex.exec(code)) !== null) loops.push({ type: 'rangefor', header: m[0], pos: m.index });

  // For each loop, determine depth by counting { and } before pos
  const loopInfos = loops.map(lp => {
    const start = lp.pos;
    const before = code.slice(0, start);
    const openBefore = (before.match(/{/g) || []).length;
    const closeBefore = (before.match(/}/g) || []).length;
    const depth = Math.max(0, openBefore - closeBefore);

    const header = lp.header || '';
    let iterKind = 'unknown';

    // Extract vars in loop condition to detect divide by 2 updates etc
    const varsInCond = [...header.matchAll(/\b([A-Za-z_]\w*)\b/g)].map(x => x[1]);
    const condVar = varsInCond.length > 0 ? varsInCond[0] : null;

    // Naively get loop body text
    let body = '';
    let openBracePos = code.indexOf('{', lp.pos);
    if (openBracePos !== -1) {
      let depthBraces = 0;
      for (let i = openBracePos; i < code.length; i++) {
        if (code[i] === '{') depthBraces++;
        else if (code[i] === '}') depthBraces--;
        if (depthBraces === 0) {
          body = code.slice(openBracePos + 1, i);
          break;
        }
      }
    }

    // Check binary search style pattern inside loop body
    let isBinarySearch = false;
    const midCalcRegex = /(\w+)\s*=\s*\(\s*([A-Za-z_]\w*)\s*\+\s*([A-Za-z_]\w*)\s*\)\s*\/\s*2\s*;/;
    const midMatch = body.match(midCalcRegex);
    if (midMatch) {
      const midVar = midMatch[1];
      const leftVar = midMatch[2];
      const rightVar = midMatch[3];

      if (varsInCond.includes(leftVar) && varsInCond.includes(rightVar)) {
        const updateLeft = new RegExp(`\\b${leftVar}\\b\\s*=\\s*${midVar}\\s*\\+\\s*1`);
        const updateRight = new RegExp(`\\b${rightVar}\\b\\s*=\\s*${midVar}\\s*-\\s*1`);
        if (updateLeft.test(body) || updateRight.test(body)) isBinarySearch = true;
      }
    }

    if (isBinarySearch) iterKind = 'log';

    // Check if condVar is updated inside loop by division or bitshift by 2
    else if (condVar) {
      const divBy2Patterns = [
        new RegExp(`\\b${condVar}\\s*=\\s*${condVar}\\s*\\/\\s*2\\b`),
        new RegExp(`\\b${condVar}\\s*>>=\\s*1\\b`),
        new RegExp(`\\b${condVar}\\s*=\\s*Math\\.floor\\(\\s*${condVar}\\s*\\/\\s*2\\s*\\)`),
        new RegExp(`\\b${condVar}\\s*=\\s*Math\\.ceil\\(\\s*${condVar}\\s*\\/\\s*2\\s*\\)`),
      ];
      if (divBy2Patterns.some(re => re.test(body))) iterKind = 'log';
    }

    // If not detected log, detect normal 'n' loops by header keywords
    if (iterKind !== 'log') {
      if (/\/= *2|\/2\b|\*\= *2|<<=|>>=/.test(header)) iterKind = 'log';
      else if (/:/.test(header)) iterKind = 'n';
      else if (/length|size|len/.test(header.toLowerCase())) iterKind = 'n';
      else if (/(<|<=|>|>=).*[\+\-]{2}|(<|<=|>|>=).*\+\+|(<|<=|>|>=).*\-\-/.test(header)) iterKind = 'n';
    }

    return { ...lp, depth, iterKind };
  });

  // Count how many 'n' loops at each depth (to detect nesting)
  const nLoopsAtDepth = {};
  for (const li of loopInfos) {
    if (li.iterKind === 'n') nLoopsAtDepth[li.depth] = (nLoopsAtDepth[li.depth] || 0) + 1;
  }

  // Max depth of any loop
  const maxDepth = loopInfos.reduce((a, b) => Math.max(a, b.depth), 0);

  // Max nested loops counting how many 'n' loops are at the same depth
  let maxNestedN = 0;
  for (let d = 0; d <= maxDepth; d++) {
    if ((nLoopsAtDepth[d] || 0) > maxNestedN) maxNestedN = nLoopsAtDepth[d];
  }

  // Detect if any log loops are present
  const logDetected = loopInfos.some(l => l.iterKind === 'log');

  return { loopCount: loops.length, maxDepth, maxNestedN, logDetected, loopInfos };
}

function detectRecursion(code) {
  const fnDecls = [];
  let m;
  const jsFunc = /function\s+([A-Za-z_]\w*)\s*\(/g;
  while ((m = jsFunc.exec(code)) !== null) fnDecls.push({ name: m[1], idx: m.index });
  const pyDef = /def\s+([A-Za-z_]\w*)\s*\(/g;
  while ((m = pyDef.exec(code)) !== null) fnDecls.push({ name: m[1], idx: m.index });

  const cStyle = /(?:[A-Za-z_][\w:<>\s\*&]+)\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/g;
  while ((m = cStyle.exec(code)) !== null) fnDecls.push({ name: m[1], idx: m.index });

  const recursion = [];
  for (const f of fnDecls) {
    const open = code.indexOf('{', f.idx);
    if (open === -1) continue;

    let depth = 0;
    let close = -1;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) { close = i; break; }
      }
    }
    if (close === -1) continue;

    const body = code.slice(open + 1, close);
    const calls = (body.match(new RegExp('\\b' + f.name + '\\s*\\(', 'g')) || []).length;
    if (calls > 0) recursion.push({ name: f.name, calls });
  }

  return { found: recursion.length > 0, functions: recursion };
}

/* -------------------------
   Main analyzer
   ------------------------- */

export default function analyzeComplexity(rawCode) {
  if (!rawCode || !rawCode.trim()) {
    return {
      time: 'O(1)',
      timeExplanation: 'Empty or trivial code.',
      space: 'O(1)',
      spaceExplanation: 'No allocations detected.',
      details: {}
    };
  }

  const cleaned = stripCommentsAndStrings(rawCode);
  const known = detectKnownAlgorithms(cleaned);
  if (known) {
    return {
      time: known.time,
      timeExplanation: known.timeExplanation,
      space: known.space,
      spaceExplanation: known.spaceExplanation || known.space,
      details: known.details || {}
    };
  }

  const loopsInfo = detectLoopsAndNesting(cleaned);
  const recursionInfo = detectRecursion(cleaned);

  let time = 'O(1)';
  let timeExplanation = 'No loops or recursion detected (heuristic).';
  let space = 'O(1)';
  let spaceExplanation = 'No obvious dynamic allocations detected.';

  // Handle recursion cases first
  if (recursionInfo.found) {
    const multi = recursionInfo.functions.some(f => f.calls > 1);
    if (multi) {
      time = 'O(2^n) (possible exponential recursive branching)';
      timeExplanation = 'Recursion with multiple recursive calls detected — likely exponential.';
      space = 'O(n) (recursion stack)';
      spaceExplanation = 'Recursion stack grows with depth.';
    } else {
      if (loopsInfo.loopCount > 0) {
        time = 'O(n log n) or O(n * (loop cost))';
        timeExplanation = 'Single recursion detected together with loops — heuristic estimate O(n log n).';
        space = 'O(n + additional)';
        spaceExplanation = 'Recursion stack + container usage.';
      } else {
        time = 'O(n) (single recursion)';
        timeExplanation = 'Single recursion detected — typically linear.';
        space = 'O(n)';
        spaceExplanation = 'Recursion stack.';
      }
    }
    return { time, timeExplanation, space, spaceExplanation, details: { loopsInfo, recursionInfo } };
  }

  // Handle loop cases
  if (loopsInfo.loopCount > 0) {
    // First check for logarithmic patterns
    if (loopsInfo.logDetected) {
      if (loopsInfo.maxNestedN === 0) {
        time = 'O(log n)';
        timeExplanation = 'Detected logarithmic loop pattern (divide-by-two behavior).';
      } else {
        time = `O(n^${loopsInfo.maxNestedN} log n)`;
        timeExplanation = `Detected ${loopsInfo.maxNestedN} nested loops with logarithmic behavior.`;
      }
    }
    // Then check for polynomial cases
    else {
      // Special case: two nested loops iterating over same array
      const hasNestedSameArrayLoop = loopsInfo.loopInfos.some(outer => {
        return loopsInfo.loopInfos.some(inner => {
          return inner.depth === outer.depth + 1 && 
                 inner.type === 'for' && 
                 outer.type === 'for' &&
                 /length|size|len/.test(outer.header.toLowerCase()) &&
                 /length|size|len/.test(inner.header.toLowerCase());
        });
      });

      if (hasNestedSameArrayLoop) {
        time = 'O(n²)';
        timeExplanation = 'Detected two nested loops iterating over same array.';
      }
      // General polynomial case
      else if (loopsInfo.maxNestedN >= 2) {
        time = `O(n^${loopsInfo.maxNestedN})`;
        timeExplanation = `Detected ${loopsInfo.maxNestedN} nested loops iterating over input size.`;
      } 
      else if (loopsInfo.maxNestedN === 1) {
        time = 'O(n)';
        timeExplanation = 'Detected single loop iterating over input size.';
      }
    }

    // Space complexity
    space = 'O(n)';
    spaceExplanation = 'Output array grows with input size.';
  }

  return {
    time,
    timeExplanation,
    space,
    spaceExplanation,
    details: {
      loopsInfo,
      recursionInfo
    }
  };
}