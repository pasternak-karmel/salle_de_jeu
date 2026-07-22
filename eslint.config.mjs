import next from 'eslint-config-next';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'prisma/migrations/**'],
  },
  ...next,
];

export default config;
