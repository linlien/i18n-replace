const colors = require("colors");
const argv = require("minimist")(process.argv.slice(2));
const { Command } = require("commander");
const program = new Command();

const Replace = require("./src/index");
const i18nReplace = new Replace();

// 注册版本号与描述
program.version("1.0.0").description("提取 .vue/.js 文件内中文字段");

// 注册参数
program.option("-f, --file", "要提取的文件目录");
program.option("-i, --i18n", "i18n引入路径");
program.option("-d, --directory", "语言包存放路径");

// 解析
program.parse(process.argv);

function main() {
  if (!argv.f && !argv.file) {
    console.error("🙅‍  提取结束，缺少提取目录参数！！！".red);
    return;
  }
  i18nReplace.main(
    argv.f || argv.file,
    argv.i || argv.i18n,
    argv.d || argv.directory
  );
}

main();
