import 'reflect-metadata';
import 'dotenv/config';
import { carregarEnv } from './config/env';
import { criarApp } from './http/app';
import { criarContainer } from './infraestrutura/container';

const env = carregarEnv(process.env);
const app = criarApp(criarContainer(env));

app.listen(env.porta, '127.0.0.1', () => {
  console.log(`pomodoro-musical na porta ${env.porta}`);
  console.log(`autorize o Spotify em: http://127.0.0.1:${env.porta}/auth/spotify`);
});
