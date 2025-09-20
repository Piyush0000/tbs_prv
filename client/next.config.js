const nextConfig = {
  output: 'export', // ✅ enables static export in Next 13+
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }];
    return config;
  },
};
