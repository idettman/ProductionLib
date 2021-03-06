/**
 * Created with IntelliJ IDEA.
 * User: Isaac Dettman
 * Date: 3/28/13
 * Time: 1:48 PM
 */
package ashframework.game.systems
{
	import ash.core.Engine;
	import ash.core.NodeList;
	import ash.core.System;

	import ashframework.game.*;
	import ashframework.game.nodes.GameNode;
	import ashframework.game.nodes.PlanetNode;
	import ashframework.game.nodes.SpaceshipNode;

	import flash.geom.Vector3D;


	public class GameManager extends System
	{
		private var config:GameConfig;
		private var creator:EntityCreator;

		private var planets:NodeList;
		private var gameNodes:NodeList;
		private var spaceships:NodeList;


		public function GameManager (creator:EntityCreator, config:GameConfig)
		{
			trace ("GameManager ()");
			this.creator = creator;
			this.config = config;
		}


		override public function addToEngine (engine:Engine):void
		{
			trace ("GameManager . addToEngine()");
			gameNodes = engine.getNodeList (GameNode);
			spaceships = engine.getNodeList (SpaceshipNode);
			planets = engine.getNodeList (PlanetNode);
		}


		override public function removeFromEngine (engine:Engine):void
		{
			trace ("GameManager . removeFromEngine()");
			planets = null;
			spaceships = null;
			gameNodes = null;
		}


		override public function update (time:Number):void
		{
			//trace ("GameManager . update(", time, ")");

			var node:GameNode;

			for (node = GameNode (gameNodes.head); node; node = GameNode (node.next))
			{
				if (spaceships.empty)
				{
					if (node.state.lives > 0)
					{
						creator.createSpaceship (new Vector3D (config.width / 2, config.height / 2, 0));

						node.state.lives--;
					}
					else
					{
						// game over
					}
				}
			}

		}
	}
}
