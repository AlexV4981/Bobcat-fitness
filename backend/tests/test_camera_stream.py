import asyncio
import unittest

from app.services.camera_stream import CameraStreamStore


JPEG_FRAME = b"\xff\xd8test-frame\xff\xd9"

#simulates a camera stream
class CameraStreamStoreTests(unittest.IsolatedAsyncioTestCase):
    async def test_publish_and_wait_for_one_frame(self) -> None:
        store = CameraStreamStore()

        await store.producer_connected("default")
        sequence = await store.publish("default", JPEG_FRAME)
        state = await store.wait_for_frame("default", after_sequence=0)

#asserting a successful camera stream to skeleton draw
        self.assertEqual(sequence, 1)
        self.assertIsNotNone(state)
        self.assertEqual(state.frame, JPEG_FRAME)
        self.assertEqual(state.producers, 1)

#tests the time out
    async def test_wait_times_out_without_a_frame(self) -> None:
        store = CameraStreamStore()

        state = await store.wait_for_frame("missing", 0, timeout=0.01)

        self.assertIsNone(state)

#current processed frame is waiting for the next new frame
    async def test_waiter_is_notified_by_new_frame(self) -> None:
        store = CameraStreamStore()
        waiter = asyncio.create_task(store.wait_for_frame("default", 0, timeout=1))

        await store.publish("default", JPEG_FRAME)
        state = await waiter

        self.assertIsNotNone(state)
        self.assertEqual(state.sequence, 1)
#tests if the JPEG is following the format
    async def test_rejects_non_jpeg_data(self) -> None:
        store = CameraStreamStore()

        with self.assertRaisesRegex(ValueError, "JPEG"):
            await store.publish("default", b"not an image")


if __name__ == "__main__":
    unittest.main()
