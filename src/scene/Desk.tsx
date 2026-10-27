/**
 * The desk: one plane at y = 0. No props, no texture; it exists to receive the
 * key light's shadow and to give the book a horizon.
 */
export function Desk() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#7b7d7f" roughness={0.96} metalness={0} />
    </mesh>
  )
}
