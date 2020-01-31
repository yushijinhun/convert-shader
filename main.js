const { convert } = require("./convertShader.js");
const { readFileSync, writeFileSync } = require("fs");
const MagicString = require("magic-string");

for (const file of process.argv.slice(2)) {
    try {
        let modified = false;
        const code = readFileSync(file, { encoding: "utf-8" });
        const source = new MagicString(code);
        for (const replacement of convert(code)) {
            modified = true;
            source.overwrite(
                replacement.start,
                replacement.end,
                replacement.content
            );
        }
        if (modified) {
            console.info(file);
            writeFileSync(file, source.toString());
        }
    } catch (e) {
        console.error(`ERR ${file} ${e}`);
    }
}
