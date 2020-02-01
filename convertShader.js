const { tokenizer } = require("acorn");

exports.convert = function* (code) {
    let postProcess = null;
    let lines = null;
    let startIdx = -1;
    let endIdx = -1;
    let state = 0;
    let lastLineEnd = -1;
    function abort() {
        state = 0;
        startIdx = -1;
        endIdx = -1;
        lastLineEnd = -1;
        lines = null;
        postProcess = null;
    }
    function* onToken(token) {
        switch (state) {
            case 0:
                if (
                    token.type.label === "name" &&
                    (
                        token.value === "fragmentShader" ||
                        token.value === "vertexShader"
                    )
                ) {
                    state++;
                }
                break;
            case 1:
                if (token.type.label === ":" || token.type.label === "=") {
                    state++;
                } else {
                    state = 0;
                }
                break;
            case 2:
                if (token.type.label === "[") {
                    startIdx = token.start;
                    lines = [];
                    postProcess = [];
                    state++;
                } else {
                    state = 0;
                }
                break;
            case 3:
                switch (token.type.label) {
                    case "string":
                        if (lastLineEnd !== -1) {
                            let first = true;
                            for (let i = lastLineEnd; i < token.start; i++) {
                                if (code[i] === "\n") {
                                    if (first) {
                                        first = false;
                                    } else {
                                        lines.push("");
                                    }
                                }
                            }
                            lastLineEnd = -1;
                        }
                        lines.push(token.value);
                        state++;
                        break;
                    case "]":
                        state = 5;
                        break;
                    default:
                        abort();
                        break;
                }
                break;
            case 4:
                switch (token.type.label) {
                    case ",":
                        state--;
                        lastLineEnd = token.end;
                        break;
                    case "]":
                        state = 5;
                        break;
                    default:
                        abort();
                        break;
                }
                break;
            case 5:
                if (token.type.label === ".") {
                    state++;
                } else {
                    abort();
                }
                break;
            case 6:
                if (token.type.label === "name"
                    && token.value === "join") {
                    state++;
                } else {
                    abort();
                }
                break;
            case 7:
                if (token.type.label === "(") {
                    state++;
                } else {
                    abort();
                }
                break;
            case 8:
                if (token.type.label === "string"
                    && token.value === "\n") {
                    state++;
                } else {
                    abort();
                }
                break;
            case 9:
                if (token.type.label === ")") {
                    endIdx = token.end;
                    for (const handle of postProcess) {
                        handle();
                    }
                    const text = lines.join("\n")
                        .replace(/[ \t]+(?=\n|$)/g, "")
                        .replace(/(^([ \t]*\n)+)|(([ \t]*\n)+$)/g, "");
                    yield {
                        start: startIdx,
                        end: endIdx,
                        content: "/* glsl */`\n" + text + "\n`"
                    };
                    abort();
                } else {
                    abort();
                }
                break;
        }
    }
    function onComment(
        isBlock, text, start, end) {
        const commentText = code.substring(start, end);
        if (lines !== null) {
            if (lastLineEnd !== -1) {
                const whitespaces = code.substring(lastLineEnd, start);
                if (whitespaces.includes("\n")) {
                    let first = true;
                    for (const ch of whitespaces) {
                        if (ch === "\n") {
                            if (first) {
                                first = false;
                            } else {
                                lines.push("");
                            }
                        }
                    }
                    // we have to guess the indent
                    const lineIdx = lines.length;
                    lines.push(commentText);
                    postProcess.push(() => {
                        function lookupIndent(delta) {
                            let skippedLines = 0;
                            for (let i = lineIdx + delta; lines[i] !== undefined; i += delta) {
                                const trimed = lines[i].trim();
                                if (!trimed.startsWith("//") && !trimed.startsWith("/*") && lines[i] !== "") {
                                    let k = 0;
                                    while (" \t".includes(lines[i][k]))
                                        k++;
                                    return {
                                        indent: lines[i].substring(0, k),
                                        line: lines[i],
                                        skippedLines: skippedLines
                                    };
                                }
                                skippedLines++;
                            }
                            return null;
                        }
                        let indent;
                        const indentUp = lookupIndent(-1);
                        const indentDown = lookupIndent(1);
                        if (indentUp === null && indentDown === null) {
                            indent = "";
                        } else if (indentUp === null) {
                            indent = indentDown.indent;
                        } else if (indentDown === null) {
                            indent = indentUp.indent;
                        } else if (indentUp.indent === indentDown.indent) {
                            indent = indentUp.indent;
                        } else {
                            const lineUp = indentUp.line.trim();
                            const lineDown = indentDown.line.trim();
                            if ("([{".includes(lineUp[lineUp.length - 1]) || lineUp.startsWith("#ifdef")) {
                                indent = indentDown.indent;
                            } else if (")]}".includes(lineDown[0]) || lineDown.startsWith("#endif")) {
                                indent = indentUp.indent;
                            } else {
                                if (indentUp.skippedLines === 0 && indentDown.skippedLines !== 0) {
                                    indent = indentUp.indent;
                                } else if (indentUp.skippedLines !== 0 && indentDown.skippedLines === 0) {
                                    indent = indentDown.indent;
                                } else {
                                    // we really need to guess one
                                    if (indentUp.indent.length > indentDown.indent.length) {
                                        indent = indentDown.indent;
                                    } else {
                                        indent = indentUp.indent;
                                    }
                                }
                            }
                        }
                        lines[lineIdx] = indent + lines[lineIdx];
                    });
                } else {
                    // comment on the same line
                    lines[lines.length - 1] += whitespaces + commentText;
                }
            } else {
                lines.push(commentText);
            }
            lastLineEnd = end;
        }
    }
    for (const token of
        tokenizer(code,
            {
                onComment: onComment
            }
        )) {
        yield* onToken(token);
    }
}
