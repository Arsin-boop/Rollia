import { createBrowserRouter } from "react-router-dom";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { CharacterName } from "./components/character-creation/CharacterName";
import { CharacterClass } from "./components/character-creation/CharacterClass";
import { CharacterBackstory } from "./components/character-creation/CharacterBackstory";
import { CharacterAppearance } from "./components/character-creation/CharacterAppearance";
import { CharacterReview } from "./components/character-creation/CharacterReview";
import { SessionCreation } from "./components/SessionCreation";
import GameSession from "./pages/GameSession";
import CharactersMenuPage from "./pages/CharactersMenuPage";
import SessionsMenuPage from "./pages/SessionsMenuPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: "character/name", element: <CharacterName /> },
      { path: "character/class", element: <CharacterClass /> },
      { path: "character/backstory", element: <CharacterBackstory /> },
      { path: "character/appearance", element: <CharacterAppearance /> },
      { path: "character/review", element: <CharacterReview /> },
      { path: "session/create", element: <SessionCreation /> },
      { path: "characters", element: <CharactersMenuPage /> },
      { path: "sessions", element: <SessionsMenuPage /> },
      { path: "game/:campaignId", element: <GameSession /> },
    ],
  },
]);

