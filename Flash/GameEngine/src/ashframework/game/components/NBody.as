/**
 * User: Isaac
 * Date: 3/29/13
 * Time: 12:36 AM
 */
package ashframework.game.components
{
	import flash.geom.Vector3D;


	public class NBody
	{
		public var mass:Number = 0;
		public var radius:Number = 0;
		public var velocity:Vector3D;
		public var angularRotation:Number;


		public function NBody (mass:Number, radius:Number, velocity:Vector3D, angularRotation:Number=0)
		{
			this.mass = mass;
			this.radius = radius;
			this.velocity = velocity;
			this.angularRotation = angularRotation;
		}
	}
}
