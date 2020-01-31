const { convert } = require("./convertShader.js");
const { readFileSync, writeFileSync } = require("fs");
const MagicString = require("magic-string");

let args = process.argv.slice(2);
let dryrun = false;
let verbose = false;
outter: for (; ;) {
    switch (args[0]) {
        case "--dry-run":
            dryrun = true;
            break;
        case "--verbose":
            verbose = true;
            break;
        default:
            break outter;
    }
    args = args.slice(1);
}

for (const file of args) {
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
            if (verbose) {
                console.info("%%% " + file);
                console.info(source.toString());
            } else {
                console.info(file);
            }
            if (!dryrun) {
                writeFileSync(file, source.toString());
            }
        }
    } catch (e) {
        console.error(`ERR ${file} ${e}`);
    }
}
