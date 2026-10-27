/**
 * 注册时的密码强度检查。
 *
 * 为什么需要它：浏览器（Chrome / Edge）在提交表单时会把明文密码在本地哈希后
 * 比对已知泄露库，命中就弹「此密码已在数据泄露中出现」。那个提示来自浏览器、
 * 不经过本站服务器，本站也没有任何地方记录明文密码。
 *
 * 弹窗无法由代码关闭（浏览器行为），但可以从源头降低触发概率：
 * 拦住「短 + 单一字符类型 + 高频弱口令」这三类密码——它们几乎必然在泄露库里。
 *
 * 只做本地同步检查，不发网络请求，不引入依赖。
 */

/** 最短长度：8 位是业界对用户口令的普遍下限 */
const MIN_LENGTH = 8;

/** 常见弱口令：泄露库里出现频次最高的那些，命中直接拒绝 */
const WEAK_PASSWORDS = new Set([
    "password", "password1", "password123", "passw0rd", "p@ssw0rd",
    "12345678", "123456789", "1234567890", "12345678910",
    "qwertyui", "qwerty123", "qwertyuiop", "1qaz2wsx", "1q2w3e4r",
    "abc12345", "abcd1234", "a1234567", "aa123456", "abc123456",
    "iloveyou", "woaini1314", "woaini520", "5201314520",
    "admin123", "administrator", "root1234", "test1234", "guest123",
    "letmein1", "welcome1", "monkey123", "dragon123", "sunshine",
    "football", "baseball", "superman", "trustno1", "starwars",
]);

/** 明显是「重复/连续」的填充串：aaaaaaaa、12345678、abcdefgh */
function isRepetitive(value: string): boolean {
    if (value.length < 4) return false;
    // 全部同一字符
    if (new Set(value).size === 1) return true;
    // 纯递增/递减（12345678、abcdefgh、87654321）
    const codes = [...value].map((c) => c.charCodeAt(0));
    const step = codes[1] - codes[0];
    if (step === 1 || step === -1) {
        return codes.every((code, i) => i === 0 || code - codes[i - 1] === step);
    }
    return false;
}

/**
 * 常见词 + 数字/符号后缀，例如 `admin12345`、`password2024`、`welcome!`。
 *
 * 只查固定弱口令表不够：用户在 `admin123` 后面多补两位就能绕过，
 * 而这类「字典词 + 数字」恰恰是泄露库里最典型的形态。
 */
function isCommonWordWithSuffix(value: string): boolean {
    // 剥掉结尾的数字和符号，看剩下的词干是否是常见词
    const stem = value.toLowerCase().replace(/[0-9!@#$%^&*._-]+$/g, "");
    if (stem.length < 4) return false;
    // 词干本身就是常见词（且原始密码确实带了后缀，否则上面已按精确匹配拦过）
    return stem !== value.toLowerCase() && COMMON_STEMS.has(stem);
}

/** 常见词干：被弱口令表覆盖的那些词的「根」 */
const COMMON_STEMS = new Set([
    "password", "passwd", "passw0rd", "admin", "administrator", "root",
    "qwerty", "qwertyuiop", "abc", "abcd", "abcde", "abcdef",
    "iloveyou", "woaini", "love", "test", "guest", "user", "login",
    "letmein", "welcome", "monkey", "dragon", "sunshine", "football",
    "baseball", "superman", "trustno", "starwars", "master", "hello",
]);

export type PasswordCheck =
    | { ok: true }
    | { ok: false; reason: "format" | "tooWeak" | "repetitive" };

/**
 * 检查密码强度。返回 `{ ok: true }` 或带原因码的失败结果，
 * 由调用方翻译成当前语言的提示文案。
 *
 * `format` 把「长度不够」和「字符类型单一」合并成同一个原因：
 * 这两条对用户来说是同一件事（密码不够强），分开报会让用户
 * 被逐条纠正两次，体验很差。
 */
export function checkPasswordStrength(password: string): PasswordCheck {
    const longEnough = password.length >= MIN_LENGTH;

    // 至少两类字符（字母 / 数字 / 符号），避免纯数字或纯字母
    const kinds =
        (/[a-z]/i.test(password) ? 1 : 0) +
        (/[0-9]/.test(password) ? 1 : 0) +
        (/[^a-z0-9]/i.test(password) ? 1 : 0);

    // 长度或字符类型任一不满足，都归为「格式不符」，用同一句话提示
    if (!longEnough || kinds < 2) {
        return { ok: false, reason: "format" };
    }

    const lower = password.toLowerCase();
    // 精确命中弱口令表，或是「常见词 + 数字后缀」的变体
    if (WEAK_PASSWORDS.has(lower) || isCommonWordWithSuffix(password)) {
        return { ok: false, reason: "tooWeak" };
    }

    if (isRepetitive(password)) {
        return { ok: false, reason: "repetitive" };
    }

    return { ok: true };
}

export { MIN_LENGTH as PASSWORD_MIN_LENGTH };
