module.exports = {
  apps: [
    {
      name: 'coal-tms',
      cwd: './backend',
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        SERVE_FRONTEND: 'true',
        FRONTEND_DIST: '../frontend/dist',
        PORT: 4000
      }
    }
  ]
};
