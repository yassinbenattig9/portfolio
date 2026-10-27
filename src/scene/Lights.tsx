/**
 * Direction A lighting, grey placeholder: one warm key (the sun through the
 * lattice window), one cool sky/ground fill, one cool rim. The key casts the
 * shadows that tell the eye the book is a physical object and give a lifting
 * cover or sheet a shading gradient.
 */
export function Lights() {
  return (
    <>
      <hemisphereLight args={['#aec8dc', '#2a2a2a', 0.65]} />

      <directionalLight
        position={[3.6, 5.4, 2.8]}
        color="#ffe7c6"
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-normalBias={0.02}
      />

      <directionalLight position={[-3.4, 2.6, -2.2]} color="#a9c6dd" intensity={0.5} />
    </>
  )
}
