// pm2 설정. 프로젝트가 ESM이라 이 파일만 .cjs 확장자를 쓴다.
module.exports = {
  apps: [
    {
      name: 'hackathon-api',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      max_memory_restart: '400M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
