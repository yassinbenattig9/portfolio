import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getBookState, useBookStore, type BookPhase } from '../state/bookState'
import { easeInOutCubic, progressAt } from '../state/timing'

/**
 * Camera pose tweening.
 *
 * Poses are plain data. A phase change captures a fixed tween (from the pose
 * the camera is in right now to the pose the phase needs) and `useFrame` walks
 * it by elapsed time. Nothing is lerped toward a moving target per frame, so
 * the result is frame-rate independent and settles exactly on the pose.
 */

export type CameraPoseName = 'closed' | 'open'

export interface CameraPose {
  readonly position: readonly [number, number, number]
  readonly target: readonly [number, number, number]
  readonly fov: number
}

export const CAMERA_POSES: Readonly<Record<CameraPoseName, CameraPose>> = {
  closed: { position: [0, 2.4, 3.2], target: [0, 0.05, 0], fov: 32 },
  open: { position: [0, 4.6, 0.55], target: [0, 0, 0], fov: 32 },
}

const POSE_FOR_PHASE: Readonly<Record<BookPhase, CameraPoseName>> = {
  CLOSED: 'closed',
  OPENING: 'open',
  OPEN: 'open',
  TURNING: 'open',
  CLOSING: 'closed',
}

/** Used only if a command lands without its own transition window. */
const CAMERA_DURATION_MS = 900

interface PoseTween {
  readonly fromPosition: THREE.Vector3
  readonly toPosition: THREE.Vector3
  readonly fromQuaternion: THREE.Quaternion
  readonly toQuaternion: THREE.Quaternion
  readonly startedAt: number
  readonly duration: number
}

export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const phase = useBookStore((state) => state.phase)
  const aim = useMemo(() => new THREE.PerspectiveCamera(), [])
  const tweenRef = useRef<PoseTween | null>(null)
  const poseRef = useRef<CameraPoseName>('closed')
  const mountedRef = useRef(false)

  useEffect(() => {
    const name = POSE_FOR_PHASE[phase]
    const pose = CAMERA_POSES[name]
    const poseChanged = poseRef.current !== name
    poseRef.current = name

    // Scratch "camera" used only to turn a position + target into a quaternion.
    aim.position.set(pose.position[0], pose.position[1], pose.position[2])
    aim.up.set(0, 1, 0)
    aim.lookAt(pose.target[0], pose.target[1], pose.target[2])

    const applyFov = () => {
      if (camera instanceof THREE.PerspectiveCamera && camera.fov !== pose.fov) {
        camera.fov = pose.fov
        camera.updateProjectionMatrix()
      }
    }

    if (!mountedRef.current) {
      // First mount: snap instead of drifting in from the Canvas default.
      mountedRef.current = true
      camera.position.copy(aim.position)
      camera.quaternion.copy(aim.quaternion)
      applyFov()
      return
    }

    if (!poseChanged) return

    const open = getBookState().open
    tweenRef.current = {
      fromPosition: camera.position.clone(),
      toPosition: new THREE.Vector3(pose.position[0], pose.position[1], pose.position[2]),
      fromQuaternion: camera.quaternion.clone(),
      toQuaternion: aim.quaternion.clone(),
      startedAt: performance.now(),
      duration: open?.duration ?? CAMERA_DURATION_MS,
    }
    applyFov()
  }, [phase, camera, aim])

  useFrame(() => {
    const tween = tweenRef.current
    if (tween === null) return

    const elapsed = progressAt(tween, performance.now())
    const eased = easeInOutCubic(elapsed)
    camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased)
    camera.quaternion.slerpQuaternions(tween.fromQuaternion, tween.toQuaternion, eased)

    if (elapsed >= 1) tweenRef.current = null
  })

  return null
}
