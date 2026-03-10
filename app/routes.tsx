import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { CharacterName } from "./components/character-creation/CharacterName";
import { CharacterClass } from "./components/character-creation/CharacterClass";
import { CharacterBackstory } from "./components/character-creation/CharacterBackstory";
import { CharacterAppearance } from "./components/character-creation/CharacterAppearance";
import { CharacterReview } from "./components/character-creation/CharacterReview";
import { SessionCreation } from "./components/SessionCreation";
import { GameInterface } from "./components/GameInterface";

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
      { path: "game/:sessionId", element: <GameInterface /> },
    ],
  },
]);