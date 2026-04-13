const USE_LOCAL = true;

const LOCAL_WS  = "ws://localhost:2567";
const LOCAL_HTTP = "http://localhost:2567";

const PROD_WS  = "wss://your-app-name.onrender.com";
const PROD_HTTP = "https://your-app-name.onrender.com";

const LOCAL_LOBBY = 'http://localhost:5173/';
const PROD_LOBBY = 'https://your-app-name.pages.dev';

const LOCAL_GAME = 'http://localhost:5174/';
const PROD_GAME = 'https://your-app-name.pages.dev';

export const SERVER_WS_URL  = USE_LOCAL ? LOCAL_WS  : PROD_WS;
export const SERVER_HTTP_URL = USE_LOCAL ? LOCAL_HTTP : PROD_HTTP;
export const LOBBY_URL = USE_LOCAL ? LOCAL_LOBBY : PROD_LOBBY;
export const GAME_URL = USE_LOCAL ? LOCAL_GAME : PROD_GAME;