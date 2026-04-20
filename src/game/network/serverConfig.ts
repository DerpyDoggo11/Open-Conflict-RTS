const USE_LOCAL = false;

const LOCAL_WS  = "ws://localhost:2567";
const LOCAL_HTTP = "http://localhost:2567";

const PROD_WS  = "wss://open-confict-rts-server.onrender.com";
const PROD_HTTP = "https://open-confict-rts-server.onrender.com";

const LOCAL_LOBBY = 'http://localhost:5173/';
const PROD_LOBBY = 'https://open-conflict-lobby.pages.dev/';

const LOCAL_GAME = 'http://localhost:5174/';
const PROD_GAME = 'https://open-conflict-rts.pages.dev/';

export const SERVER_WS_URL  = USE_LOCAL ? LOCAL_WS  : PROD_WS;
export const SERVER_HTTP_URL = USE_LOCAL ? LOCAL_HTTP : PROD_HTTP;
export const LOBBY_URL = USE_LOCAL ? LOCAL_LOBBY : PROD_LOBBY;
export const GAME_URL = USE_LOCAL ? LOCAL_GAME : PROD_GAME;