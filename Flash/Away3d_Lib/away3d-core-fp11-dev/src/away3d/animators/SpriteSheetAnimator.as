package away3d.animators
{
	import away3d.arcane;
	import away3d.animators.data.*;
	import away3d.animators.nodes.*;
	import away3d.animators.states.ISpriteSheetAnimationState;
	import away3d.animators.states.SpriteSheetAnimationState;
	import away3d.animators.transitions.IAnimationTransition;
	import away3d.core.base.*;
	import away3d.core.managers.*;
	import away3d.materials.*;
	import away3d.materials.passes.*;
	import away3d.cameras.Camera3D;

	import flash.display3D.Context3DProgramType;
	import flash.utils.getTimer;

	use namespace arcane;
	
	/**
	 * Provides an interface for assigning uv-based sprite sheet animation data sets to mesh-based entity objects
	 * and controlling the various available states of animation through an interative playhead that can be
	 * automatically updated or manually triggered.
	 */
	public class SpriteSheetAnimator extends AnimatorBase implements IAnimator
	{
		private var _activeSpriteSheetState:ISpriteSheetAnimationState;
		private var _spriteSheetAnimationSet:SpriteSheetAnimationSet;
		private var _frame : SpriteSheetAnimationFrame = new SpriteSheetAnimationFrame();
		private var _vectorFrame : Vector.<Number>;

		private var _fps : uint = 10;
		private var _ms : uint = 100;
		private var _lastTime : uint;
		private var _reverse : Boolean;
		private var _backAndForth : Boolean;
		private var _specsDirty : Boolean;
		
		/**
		 * Creates a new <code>SpriteSheetAnimator</code> object.
		 * @param spriteSheetAnimationSet  The animation data set containing the sprite sheet animation states used by the animator.
		 */
		public function SpriteSheetAnimator(spriteSheetAnimationSet:SpriteSheetAnimationSet)
		{
			super(spriteSheetAnimationSet);
			_spriteSheetAnimationSet =  spriteSheetAnimationSet;
			_vectorFrame = new Vector.<Number>();
		}

		 /* Set the playrate of the animation in frames per second (not depending on player fps)*/
		public function set fps(val:uint):void
		{
			_ms = 1000/val;
			_fps = val;
		}
		public function get fps():uint
		{
			return _fps;
		}

		 /* If true, reverse causes the animation to play backwards*/
		public function set reverse(b:Boolean):void
		{
			_reverse = b;
			_specsDirty = true;
		}
		public function get reverse():Boolean
		{
			return _reverse;
		}

		/* If true, backAndForth causes the animation to play backwards and forward alternatively. Starting forward.*/
		public function set backAndForth(b:Boolean):void
		{
			_backAndForth = b;
			_specsDirty = true;
		}
		public function get backAndForth():Boolean
		{
			return _backAndForth;
		}
		
		/**
		 * @inheritDoc
		 */
		public function setRenderState(stage3DProxy : Stage3DProxy, renderable : IRenderable, vertexConstantOffset : int, vertexStreamOffset : int, camera:Camera3D) : void
		{	
			var material:MaterialBase = renderable.material;
			if( !material || !material is TextureMaterial) return;

			var subMesh:SubMesh = renderable as SubMesh;
			if (!subMesh) return;

			_vectorFrame[0] = _frame.offsetU;
			_vectorFrame[1] = _frame.offsetV;
			_vectorFrame[2] = _frame.scaleU;
			_vectorFrame[3] = _frame.scaleV;
			
			if( material is SpriteSheetMaterial ){
				SpriteSheetMaterial(material).swap(_frame.mapID);
			}

 			//vc[vertexConstantOffset]
			stage3DProxy._context3D.setProgramConstantsFromVector(Context3DProgramType.VERTEX, vertexConstantOffset, _vectorFrame);
		}
		
		/**
		 * @inheritDoc
		 */
		 public function play(name : String, transition : IAnimationTransition = null, offset : Number = NaN) : void
		{
			if (_name == name)
				return;
			
			_name = name;
			
			if (!_animationSet.hasAnimation(name))
				throw new Error("Animation root node " + name + " not found!");
			
			_activeNode = _animationSet.getAnimation(name);
			_activeState = getAnimationState(_activeNode);
			_frame = SpriteSheetAnimationState(_activeState).currentFrameData; 
			_activeSpriteSheetState = _activeState as ISpriteSheetAnimationState;
			
			start();
		}
		
		/**
		 * Applies the calculated time delta to the active animation state node.
		 */
		override protected function updateDeltaTime(dt : Number) : void
		{
			if(_specsDirty){
				SpriteSheetAnimationState(_activeSpriteSheetState).reverse = _reverse;
				SpriteSheetAnimationState(_activeSpriteSheetState).backAndForth = _backAndForth;
				_specsDirty = false;
			}
			
			_absoluteTime += dt;
			var now:int = getTimer();
			if((now-_lastTime) > _ms){
				_activeSpriteSheetState.update(_absoluteTime);
				_lastTime = now;
			}
			
			_frame = SpriteSheetAnimationState(_activeSpriteSheetState).currentFrameData; 
		}
		
		/**
	         * Verifies if the animation will be used on cpu. Needs to be true for all passes for a material to be able to use it on gpu.
		* Needs to be called if gpu code is potentially required.
	         */
	        public function testGPUCompatibility(pass : MaterialPassBase) : void {}
		
		public function clone():IAnimator
		{
			return new SpriteSheetAnimator(_spriteSheetAnimationSet);
		}
		
	}
}