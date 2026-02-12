// PM2 ecosystem configuration for Wien Öffi Collector
// Usage: pm2 start ecosystem.config.js

export default {
  apps: [{
    name: 'wien-oeffi-collector',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Restart on crash with exponential backoff
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
  }]
};
