module.exports = {
  apps: [
    {
      name: "botify",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "cluster",
      instances: "max",
      max_memory_restart: process.env.PM2_MAX_MEMORY || "768M",
      wait_ready: true,
      listen_timeout: 8000,
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
      },
      node_args: "--max-old-space-size=768",
      exp_backoff_restart_delay: 200,
    },
  ],
}
