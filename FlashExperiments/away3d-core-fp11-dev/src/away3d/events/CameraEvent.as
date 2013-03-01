/**
 *
 */
package away3d.events
{
	import away3d.cameras.Camera3D;

	import flash.events.Event;


	public class CameraEvent extends Event
	{
		public static const LENS_CHANGED : String = "lensChanged";

		private var _camera : Camera3D;

		public function CameraEvent(type : String, camera : Camera3D, bubbles : Boolean = false, cancelable : Boolean = false)
		{
			super(type,  bubbles, cancelable);
			_camera = camera;
		}

		public function get camera() : Camera3D
		{
			return _camera;
		}

		override public function clone() : Event
		{
			return new CameraEvent(type, _camera, bubbles,  cancelable);
		}
	}
}
