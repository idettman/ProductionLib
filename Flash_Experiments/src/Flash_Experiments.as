package
{

	import base.display.AbstractSprite;

	import lunchwheel.LunchWheel_Test;


	[SWF(width="1024", height="760", frameRate="60")]
	public class Flash_Experiments extends AbstractSprite
	{
		[Embed(source="./../assets/fonts/RobotoCondensed-Regular.ttf", embedAsCFF="false", fontFamily="RobotoCondensed Regular", fontWeight="regular", mimeType="application/x-font-truetype")]
		public static var Font_RobotoCondensed_Regular:Class;


		public function Flash_Experiments ()
		{
			super ();
		}
		

		override protected function init ():void
		{
			super.init ();

			//addChild (new AbstractAway3D ());
			//addChild (new OimoPhysicsAway3dIntegrationTest());
			//addChild (new PinballTest ());
			//addChild (new PinballFieldBlocking ());
			//addChild (new JointTest ());
			//addChild (new FlareTest ());
			//addChild (new Tween24_Test ());
			//addChild(new TestGreenSock());
			//addChild(new DrawArcsAndPolys_Test());
			//addChild (new CreateWheelGeometry_Test ());
			//addChild (new CreatePolygonWithRectangles_Test ());

			addChild (new LunchWheel_Test ());
		}
	}
}
