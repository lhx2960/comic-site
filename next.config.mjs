/* =============================================================================
 * Next.js 构建配置
 *
 * 这一层只放构建期开关，不放业务逻辑。本项目刻意保持极简：数据在仓库里
 * （data/ 与 public/），没有数据库与外部服务，所以这里不读环境变量，也没有
 * rewrites / headers 之类的运行期规则。
 *
 * 关于图片：占位图都在 public/comics/ 下，属于本地资源，next/image 会走 Next
 * 自带的图片优化管线，不需要配置 remotePatterns（那个只对外域图片有意义）。
 * 将来若把图片挪到对象存储，才需要在这里补 images.remotePatterns。
 * ========================================================================== */

// 关闭 Next.js 遥测：构建期它会往用户目录（%APPDATA%\nextjs-nodejs）写一个全局
// 配置文件，在受限环境里这一步会失败并中断构建。这一步必须在读取配置之前完成，
// 所以放在模块最顶部执行；对外部构建（Vercel）同样是「少一次无关的外部写入」。
process.env.NEXT_TELEMETRY_DISABLED ??= "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发期用 React 严格模式跑两遍渲染，提前暴露写在渲染期的副作用。
  reactStrictMode: true,
};

export default nextConfig;
