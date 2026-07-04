/**
 * Shared SandboxVars.lua parser.
 * Works both in Node (module.exports) and in the browser (window.parseSandboxVars).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.LuaParser = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {

    function stripFormattingTags(text) {
        return text.replace(/<\/?[A-Za-z]+(:[^>]*)?>/g, '').replace(/\s+/g, ' ').trim();
    }

    const ENUM_OPTION_RE = /^(-?\d+)\s*=\s*(.+)$/;
    const MINMAXDEFAULT_RE = /Min:\s*(-?[\d.]+)\s*Max:\s*(-?[\d.]+)\s*Default:\s*([-\w.]+(?:\s+\w+)*?)(?=\s*$|\s{2,})/;
    const DEFAULT_ONLY_RE = /Default\s*=\s*(.+)$/;

    function inferType(valueStr, hasEnumOptions) {
        if (hasEnumOptions) return 'enum';
        if (valueStr === 'true' || valueStr === 'false') return 'boolean';
        if (/^".*"$/.test(valueStr)) return 'string';
        if (/^-?\d+$/.test(valueStr)) return 'integer';
        if (/^-?\d*\.\d+$/.test(valueStr)) return 'float';
        return 'string';
    }

    function parseValue(valueStr, type) {
        if (type === 'boolean') return valueStr === 'true';
        if (type === 'string') return valueStr.replace(/^"|"$/g, '');
        if (type === 'integer' || type === 'enum') return parseInt(valueStr, 10);
        if (type === 'float') return parseFloat(valueStr);
        return valueStr;
    }

    const KEY_VALUE_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?),?\s*$/;
    const NESTED_TABLE_OPEN_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{\s*$/;

    function parseSandboxVars(raw) {
        const lines = raw.split(/\r?\n/);
        const rootSection = { name: 'General', path: null, params: [] };
        const sections = [rootSection];
        let sectionStack = [rootSection];
        let pendingCommentLines = [];
        let totalParams = 0;
        const noCommentParams = [];
        let version = null;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed === '' || trimmed === 'SandboxVars = {') continue;

            if (trimmed === '}') {
                if (sectionStack.length > 1) sectionStack.pop();
                continue;
            }

            if (trimmed.startsWith('--')) {
                pendingCommentLines.push(trimmed.replace(/^--\s?/, ''));
                continue;
            }

            const nestedMatch = trimmed.match(NESTED_TABLE_OPEN_RE);
            if (nestedMatch) {
                const sectionName = nestedMatch[1];
                const newSection = { name: sectionName, path: sectionName, params: [] };
                sections.push(newSection);
                sectionStack.push(newSection);
                pendingCommentLines = [];
                continue;
            }

            const versionMatch = trimmed.match(/^VERSION\s*=\s*(\d+)/);
            if (versionMatch) {
                version = parseInt(versionMatch[1], 10);
                pendingCommentLines = [];
                continue;
            }

            const kvMatch = trimmed.match(KEY_VALUE_RE);
            if (kvMatch) {
                const key = kvMatch[1];
                const rawValue = kvMatch[2].replace(/,\s*$/, '');

                const enumOptions = [];
                const descLines = [];
                let min = null, max = null, defaultValue = null;

                for (const cline of pendingCommentLines) {
                    const enumMatch = cline.match(ENUM_OPTION_RE);
                    const mmdMatch = cline.match(MINMAXDEFAULT_RE);
                    if (enumMatch) {
                        enumOptions.push({ value: parseInt(enumMatch[1], 10), label: enumMatch[2].trim() });
                        continue;
                    }
                    if (mmdMatch) {
                        min = parseFloat(mmdMatch[1]);
                        max = parseFloat(mmdMatch[2]);
                        const defRaw = mmdMatch[3].trim();
                        defaultValue = /^-?[\d.]+$/.test(defRaw) ? parseFloat(defRaw) : defRaw;
                        const stripped = cline.replace(MINMAXDEFAULT_RE, '').trim();
                        if (stripped) descLines.push(stripped);
                        continue;
                    }
                    descLines.push(cline);
                }

                const hasEnumOptions = enumOptions.length > 0;
                const type = inferType(rawValue, hasEnumOptions);
                const value = parseValue(rawValue, type);

                let description = stripFormattingTags(descLines.join(' '));
                if (defaultValue === null) {
                    const defOnlyMatch = description.match(DEFAULT_ONLY_RE);
                    if (defOnlyMatch) defaultValue = defOnlyMatch[1].trim();
                }

                if (descLines.length === 0 && enumOptions.length === 0) {
                    noCommentParams.push(key);
                }

                const currentSection = sectionStack[sectionStack.length - 1];
                const fullPath = currentSection.path ? `${currentSection.path}.${key}` : key;

                currentSection.params.push({
                    key, path: fullPath, section: currentSection.name,
                    value, type, description, min, max, default: defaultValue,
                    options: hasEnumOptions ? enumOptions : null,
                });
                totalParams++;
                pendingCommentLines = [];
                continue;
            }

            if (trimmed !== '') pendingCommentLines = [];
        }

        return {
            sections: sections.map((s) => ({ name: s.name, paramCount: s.params.length, params: s.params })),
            version,
            totalParams,
            noCommentParams,
        };
    }

    function formatLuaValue(param, value) {
        if (param.type === 'boolean') return value ? 'true' : 'false';
        if (param.type === 'string') return `"${String(value).replace(/"/g, '\\"')}"`;
        if (param.type === 'integer' || param.type === 'enum') return String(Math.trunc(value));
        if (param.type === 'float') {
            if (Number.isInteger(value)) return value.toFixed(1);
            return String(value);
        }
        return String(value);
    }

    function formatNum(type, num) {
        return type === 'float' ? Number(num).toFixed(2) : String(Math.trunc(num));
    }

    function buildCommentBlock(param) {
        const lines = [];
        if (param.description) lines.push(param.description);
        if (param.options && param.options.length) {
            if (param.default !== null && param.default !== undefined && typeof param.default === 'string' && !param.description.includes('Default =')) {
                lines[lines.length - 1] = (lines[lines.length - 1] ? lines[lines.length - 1] + ' ' : '') + `Default = ${param.default}`;
            }
            for (const opt of param.options) {
                lines.push(`${opt.value} = ${opt.label}`);
            }
        } else if (param.min !== null && param.min !== undefined) {
            const defStr = typeof param.default === 'number' ? formatNum(param.type, param.default) : String(param.default);
            const minStr = formatNum(param.type, param.min);
            const maxStr = formatNum(param.type, param.max);
            lines.push(`Min: ${minStr} Max: ${maxStr} Default: ${defStr}`);
        }
        return lines;
    }

    function generateLua(sections, values, version) {
        const out = [];
        out.push('SandboxVars = {');
        out.push(`    VERSION = ${version != null ? version : 6},`);

        for (const section of sections) {
            const indent = section.name === 'General' ? '    ' : '        ';
            if (section.name !== 'General') {
                out.push(`    ${section.name} = {`);
            }
            for (const param of section.params) {
                const commentLines = buildCommentBlock(param);
                for (const cl of commentLines) out.push(`${indent}-- ${cl}`);
                const value = values[param.path] !== undefined ? values[param.path] : param.value;
                out.push(`${indent}${param.key} = ${formatLuaValue(param, value)},`);
            }
            if (section.name !== 'General') {
                out.push('    },');
            }
        }
        out.push('}');
        return out.join('\n') + '\n';
    }

    return { parseSandboxVars, generateLua, formatLuaValue };
});
