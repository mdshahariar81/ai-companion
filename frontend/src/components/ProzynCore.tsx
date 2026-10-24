import ProzynAvatar, {
  type AvatarState,
  type Identity,
} from "./ProzynAvatar";

export type Persona = Identity;

export type CoreState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

function mapState(state: CoreState): AvatarState {
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  if (state === "speaking") return "speaking";

  return "ready";
}

export default function ProzynCore({
  persona,
  state,
  getLevel,
}: {
  persona: Persona;
  state: CoreState;
  getLevel?: () => number;
}) {
  return (
    <ProzynAvatar
      identity={persona}
      state={mapState(state)}
      getLevel={getLevel}
    />
  );
}
