package away3d.animators
{
	import flash.display3D.Context3D;
	import away3d.animators.data.SpriteSheetAnimationFrame;
	import away3d.materials.passes.MaterialPassBase;
	import away3d.core.managers.Stage3DProxy;
	
	/**
	 * The animation data set containing the Spritesheet animation state data.
	 * 
	 * @see away3d.animators.SpriteSheetAnimator
	 * @see away3d.animators.SpriteSheetAnimationState
	 */
	public class SpriteSheetAnimationSet extends AnimationSetBase implements IAnimationSet
	{	
		private var _frame:SpriteSheetAnimationFrame; 
		private var _agalCode:String;

		/**
		* @inheritDoc
		*/
		public function getAGALVertexCode(pass:MaterialPassBase, sourceRegisters:Vector.<String>, targetRegisters:Vector.<String>):String
		{
			_agalCode = "mov "+targetRegisters[0]+", "+sourceRegisters[0]+"\n";
			_agalCode += "mov "+targetRegisters[1]+", "+sourceRegisters[1]+"\n";

			return "";
		}
		 
		/**
		 * @inheritDoc
		 */
		public function activate(stage3DProxy:Stage3DProxy, pass:MaterialPassBase):void {}
		
		/**
		 * @inheritDoc
		 */
		public function deactivate(stage3DProxy:Stage3DProxy, pass:MaterialPassBase):void
		{
			var context : Context3D = stage3DProxy.context3D;
			context.setVertexBufferAt(0, null);
		}
		
		/**
		 * @inheritDoc
		 */
		public function getAGALFragmentCode(pass : MaterialPassBase, shadedTarget : String) : String
		{
			return "";
		}
		
		/**
		 * @inheritDoc
		 */
		public function getAGALUVCode(pass : MaterialPassBase, UVSource : String, UVTarget:String) : String
		{
			var tempUV : String = "vt"+UVSource.substring(2,3);		
			var idConstant:int = pass.numUsedVertexConstants;
			var constantRegID : String = "vc" + idConstant;

			_agalCode += "mov " + tempUV +", "+ UVSource +"\n";
			_agalCode += "mul " + tempUV +".xy, "+ tempUV +".xy, "+ constantRegID+".zw \n";	 
			_agalCode += "add " + tempUV +".xy, "+ tempUV +".xy, "+ constantRegID+".xy \n";
			_agalCode += "mov " + UVTarget +", "+ tempUV+"\n";

			return _agalCode;
	 
		}
		
		/**
		 * @inheritDoc
		 */
		public function doneAGALCode(pass : MaterialPassBase):void {}
		
	}
}

