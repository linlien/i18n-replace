const fs = require("fs");
const path = require("path");
const colors = require("colors");

// 中文正则
const ZHCN = /(['"`])([^'"`\n]*[\u4e00-\u9fa5]+[^'"`\n]*)(['"`])/gim;
// 中文带符号正则
const ZHCN_SYMBOL = /[\u4e00-\u9fa5\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]+/;

class Replace {
  constructor() {
    this.inputPath = ""; // 提取路径
    this.i18nPath = "@/locales"; // i18n路径
    this.outputPath = "@/locales/modules"; // json文件输出路径
    this.total = 0; // 处理文件总数
    this.index = 0;
    this.messages = {}; // 储存以提取的键名
    this.langPack = {}; // 语言包对象
  }

  /**
   * 遍历目录
   * @param {* string} inputPath 需要遍历的目录
   * @param {* string} i18nPath i18n引入路径
   * @param {* string} outputPath 导出json文件的目录
   */
  main(inputPath, i18nPath, outputPath) {
    this.inputPath = inputPath;
    if (i18nPath) this.i18nPath = i18nPath;
    if (outputPath) this.outputPath = outputPath;
    console.log(
      `
        提取目录：${inputPath}
        i18n引入目录：${this.i18nPath}
        导出json文件的目录：${this.outputPath}
      `.green
    );

    const files = fs.readdirSync(inputPath);
    files.forEach((file) => {
      const dir = path.join(inputPath, file);
      const state = fs.statSync(dir);
      // 判断是否为文件夹
      if (state.isDirectory()) {
        this.recursiveTraversal(dir);
      } else {
        this.readVueOrJsFile(dir);
      }
      this.createLangPack();
    });
  }

  /**
   * 生成语言包文件
   */
  createLangPack() {
    const file = path.join(this.outputPath, "zh_cn.json");
    fs.writeFileSync(file, JSON.stringify(this.langPack));
    console.log(`✔ 生成语言包成功，存放路径: ${file}`.green);
  }

  /**
   * 递归遍历目录
   * @param {* string} directory 需要遍历的目录
   */
  recursiveTraversal(directory) {
    const files = fs.readdirSync(directory);
    for (let file of files) {
      const dir = path.join(directory, file);
      const state = fs.statSync(dir);
      if (state.isDirectory()) {
        this.recursiveTraversal(dir);
      } else {
        this.readVueOrJsFile(dir);
      }
    }
  }

  /**
   * 读取vue/js文件
   * @param {* string} file
   */
  readVueOrJsFile(file) {
    const name = path.extname(file).toLowerCase();
    if (name === ".js") {
      this.index = 0;
      this.replaceJsFile(file);
    }
    if (name === ".vue") {
      this.index = 0;
      this.replaceVueFile(file);
    }
  }

  /**
   * 替换js文件内容
   * @param {* string} file
   */
  replaceJsFile(file) {
    this.total++;
    console.log(`➤ 开始替换${file}文件`.blue);
    let content = fs.readFileSync(file, "utf8");
    content = `import i18n from '${this.i18nPath}'\n${content}`;
    const arr = content.split("\n");

    for (let i = 0; i < arr.length; i++) {
      const ctx = arr[i];
      const patrn = /[\u4e00-\u9fa5]|[\ufe30-\uffa0]/gi;
      if (/\/\//.test(ctx) || /[*]/im.test(ctx) || /console./.test(ctx)) {
        continue;
      }
      if (!patrn.exec(ctx)) {
        continue;
      }
      arr[i] = arr[i].replace(ZHCN, (match, prev, string, next) => {
        let _string = string.trim();
        if (prev !== "`") {
          const key = this.createLangKey(_string, file);
          this.langPack[key] = _string;
          return `i18n.t('${key}')`;
        }
        let stringIndex = 0;
        const stringArr = [];
        _string = _string.replace(
          /(\${)([^{}]+)(})/gim,
          (match, prev, string) => {
            stringArr.push(string);
            return `{${stringIndex++}}`;
          }
        );
        const key = this.createLangKey(_string, file);
        this.langPack[key] = _string;
        if (!stringArr.length) {
          return `i18n.t('${key}')`;
        } else {
          return `i18n.t('${key}', [${stringArr.toString()}])`;
        }
      });
    }

    content = arr.join("\n");
    fs.writeFileSync(file, content, "utf-8");
    console.log(`✅ 替换${file}文件成功`.green);
  }

  /**
   * 替换vue文件内容
   * @param {* string} file
   */
  replaceVueFile(file) {
    this.total++;
    console.log(`➤ 开始替换${file}文件`.blue);
    let content = fs.readFileSync(file, "utf8");

    // 替换template中的部分
    content = content.replace(/<template(.|\n)*template>/gim, (_match) => {
      const arr = _match.split("\n");
      for (let i = 0; i < arr.length; i++) {
        const patrn = /[\u4e00-\u9fa5]|[\ufe30-\uffa0]/gi;
        if (!patrn.exec(arr[i])) {
          continue;
        }
        // 替换属性文本
        arr[i] = this.replaceAttr(arr[i], file);

        // 替换标签文本
        if (/[\u4e00-\u9fa5]+/.test(arr[i])) {
          arr[i] = this.replaceTag(arr[i], file);
        }
      }
      return arr.join("\n");
    });

    // 替换script中的部分
    content = content.replace(/<script(.|\n)*script>/gim, (match) => {
      const arr = match.split("\n");
      for (let i = 0; i < arr.length; i++) {
        const ctx = arr[i];
        const patrn = /[\u4e00-\u9fa5]|[\ufe30-\uffa0]/gi;
        if (/\/\//.test(ctx) || /[*]/im.test(ctx) || /console./.test(ctx)) {
          continue;
        }
        if (!patrn.exec(ctx)) {
          continue;
        }
        arr[i] = arr[i].replace(ZHCN, (match, prev, string, next) => {
          let _string = string.trim();
          if (prev !== "`") {
            const key = this.createLangKey(_string, file);
            this.langPack[key] = _string;
            return `this.$t('${key}')`;
          }
          let stringIndex = 0;
          const stringArr = [];
          _string = _string.replace(
            /(\${)([^{}]+)(})/gim,
            (match, prev, string) => {
              stringArr.push(string);
              return `{${stringIndex++}}`;
            }
          );
          const key = this.createLangKey(_string, file);
          this.langPack[key] = _string;
          if (!stringArr.length) {
            return `this.$t('${key}')`;
          } else {
            return `this.$t('${key}', [${stringArr.toString()}])`;
          }
        });
      }
      return arr.join("\n");
    });

    fs.writeFileSync(file, content, "utf-8");
    console.log(`✔ 替换${file}文件成功`.green);
  }

  /**
   * 替换属性文本
   */
  replaceAttr(text, file) {
    let patrn_attr = /(:?\w*|:?\w*-\w*)(=)(["']((.*))["'])/;
    const res = text.replace(patrn_attr, (match) => {
      const attrArr = this.createAttrArr(match);
      const newArr = attrArr.map((ctx) => {
        let _ctx = ctx.replace(ZHCN, (match, prev, string, next) => {
          // 模版字符串
          if (prev === "`") {
            let stringIndex = 0;
            const stringArr = [];
            let _string = string.replace(
              /(\${)([^{}]+)(})/gim,
              (match, prev, str) => {
                stringArr.push(str);
                return `{${stringIndex++}}`;
              }
            );
            const key = this.createLangKey(_string, file);
            this.langPack[key] = _string;
            if (!stringArr.length) {
              return `$t('${key}')`;
            } else {
              return `$t('${key}', [${stringArr.toString()}])`;
            }
          }
          // 普通字符串
          const key = this.createLangKey(string, file);
          this.langPack[key] = string;
          if (ctx.indexOf(":") >= 0) {
            return `$t('${key}')`;
          } else {
            return `"$t('${key}')"`;
          }
        });
        if (_ctx.indexOf(":") < 0 && _ctx.includes("$t")) {
          _ctx = ":" + _ctx;
        }
        return _ctx;
      });
      return newArr.join(" ");
    });
    return res;
  }

  replaceTag(text, file) {
    // 先替换 {{}} 内的字符串
    text = text.replace(/({{).*(}})/gim, (match) => {
      match = match.replace(ZHCN, (string) => {
        const key = this.createLangKey(string, file);
        this.langPack[key] = string;
        return `$t('${key}')`;
      });
      return match;
    });
    text = text.replace(/(>)(.*)(<\/)/, (match, prev, string, next) => {
      if (/[\u4e00-\u9fa5]+/.test(string)) {
        if (/({{).*(}})/.test(string)) {
          let stringIndex = 0;
          const stringArr = [];
          let _string = string.replace(
            /({{)(.*)(}})/gim,
            (match, prev, str) => {
              stringArr.push(str);
              return `{${stringIndex++}}`;
            }
          );
          const key = this.createLangKey(_string, file);
          this.langPack[key] = _string;
          if (!stringArr.length) {
            return `${prev}{{$t('${key}')}}${next}`;
          } else {
            return `${prev}{{$t('${key}', [${stringArr.toString()}])}}${next}`;
          }
        } else {
          const key = this.createLangKey(string, file);
          this.langPack[key] = string;
          return `${prev}{{$t('${key}')}}${next}`;
        }
      } else {
        return match;
      }
    });
    if (/[\u4e00-\u9fa5]+/.test(text)) {
      if (/({{).*(}})/.test(text)) {
        let stringIndex = 0;
        const stringArr = [];
        let _string = text.replace(/({{)(.*)(}})/gim, (match, prev, str) => {
          stringArr.push(str);
          return `{${stringIndex++}}`;
        });
        const key = this.createLangKey(_string, file);
        this.langPack[key] = _string;
        if (!stringArr.length) {
          text = `${prev}{{$t('${key}')}}${next}`;
        } else {
          text = `${prev}{{$t('${key}', [${stringArr.toString()}])}}${next}`;
        }
      } else {
        const key = this.createLangKey(text, file);
        this.langPack[key] = text;
        text = `{{$t('${key}')}}`;
      }
    }

    return text;
  }

  /**
   * 生成语言包key
   */
  createLangKey(match, file) {
    if (this.messages[match]) {
      return this.messages[match];
    }
    const key = `${path
      .relative(this.inputPath, file)
      .replace(/[\\/\\\\-]/g, "_")
      .replace(/\..*$/, "")}_${this.index++}`;
    this.messages[match] = key;
    return key;
  }

  /**
   * 多属性字符串转化为数组
   */
  createAttrArr(match) {
    const attrArr = match.split(" ");
    const newAttrArr = [];
    let attr = "";
    attrArr.forEach((str, index) => {
      if (str.includes("=")) {
        if (attr) newAttrArr.push(attr);
        attr = str;
      } else {
        attr += str;
      }
      if (index + 1 === attrArr.length) newAttrArr.push(attr);
    });
    return newAttrArr;
  }
}

module.exports = Replace;
