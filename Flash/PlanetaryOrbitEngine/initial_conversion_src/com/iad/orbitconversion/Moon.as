package com.iad.orbitconversion
{
	public class Moon
	{
		public var p:Point;  // position
		public var v:Point;  // velocity
		public var a:Point;  // acceleration
		public var m:Number;  // mass
		public var c:Color;  // color
		/*
		 ov,oa,nop,noa are circular queues of length HISTORY.
		 The array positions [i] and [i+history] must be pointers to the
		 same thing for this to work.

		 If you need this as a queue, the elements are in [head] to
		 [head+history-1].  If you just need to do something to all
		 entries, it's fine to do it on [0] to [history-1].

		 We store old velocities (really differences between consecutive
		 positions) rather than actual old positions so that we can represent
		 the velocity with full precision even when it is very small compared
		 to the position.
		 */
		public var ov:Vector.<Point>;// old velocities (really ov[0] would be op[0]-op[1])
		public var oa:Vector.<Point>;// old accelerations
		public var nov:Vector.<Point>;// new old velocities (for changing gears)
		public var noa:Vector.<Point>;// new old accelerations (for changing gears)
		public var head:int;    // array offset of head of queues ov, oa, nov, noa

		// number of points used by step()
		public static var POINTS:int = 9;       // number of points in step method
		public static var PERIOD:int = POINTS - 1;// same error at ov[i] and ov[i+PERIOD]
		
		// size of queues
		public static var history:int = 2 * POINTS + 2;
		
		// method to build polynomials to dejitter and rescale
		public static var dejit:BInterpolate = new BInterpolate (POINTS);
		
		public var r:Number;     // radius
		public var id:int;    // identifier
		public var screenx:Number;  // x coordinate on screen
		public var screeny:Number;  // y coordinate on screen
		public var screenr:Number;  // radius on screen
		public var peye:Point;   // point as translated by the eye

		// p(x,y,z) v(x,y,z) mass color size
		// example, "p(0.0,0.0,0.0) v(0.0,0.0,0.0) 1.0 ff00ff 1.0"
		public function Moon (str:String, id:int)
		{
			var st:StringTokenizer = new StringTokenizer (str);
			var p:Point = new Point (0.0, 0.0, 0.0);
			var v:Point = new Point (0.0, 0.0, 0.0);

			p.x = Point.s2d (st.nextToken (), 0.0);
			p.y = Point.s2d (st.nextToken (), 0.0);
			p.z = Point.s2d (st.nextToken (), 0.0);
			v.x = Point.s2d (st.nextToken (), 0.0);
			v.y = Point.s2d (st.nextToken (), 0.0);
			v.z = Point.s2d (st.nextToken (), 0.0);
			var mass:Number = Point.s2d (st.nextToken (), 0.0);
			var c:Color = Point.s2c (st.nextToken (), Color.white);
			var planetsize:Number = Point.s2d (st.nextToken (), 0.0);
			setMoon (p, v, mass, c, planetsize, id);
		}

		/*public function Moon (p:Point,    // position
				v:Point,    // velocity
				m:Number,    // mass
				c:Color,    // color
				r:Number,    // radius
				id:int)   // identifier
		{ setMoon (p, v, m, c, r, id); }*/

		public function setMoon (p:Point, v:Point, m:Number, c:Color, r:Number, id:int):void
		{
			this.ov = new Vector.<Point>(2 * history);
			this.oa = new Vector.<Point>(2 * history);
			this.nov = new Vector.<Point>(2 * history);
			this.noa = new Vector.<Point>(2 * history);

			for (var i:int = 0; i < Moon.history; ++i)
			{
				this.ov[i] = this.ov[i + history] = new Point (0.0, 0.0, 0.0);
				this.oa[i] = this.oa[i + history] = new Point (0.0, 0.0, 0.0);
				this.nov[i] = this.nov[i + history] = new Point (0.0, 0.0, 0.0);
				this.noa[i] = this.noa[i + history] = new Point (0.0, 0.0, 0.0);
			}
			this.id = id;
			this.p = new Point (p.x, p.y, p.z);
			this.v = new Point (v.x, v.y, v.z);
			this.a = new Point (0.0, 0.0, 0.0);
			this.m = m;
			this.r = r;
			this.c = c;

			this.peye = new Point (0.0, 0.0, 0.0);
			this.head = Moon.history;
		}

		/**
		 * step - the step function, used to find the moon's next position
		 * This routine just sets p.
		 */
		public function step (inc:Number, tempValue:Point):void
		{
			// An explicit symmetric multistep method for estimating the
			// next position.
			// See http://burtleburtle.net/bob/math/multistep.html
			// ov and oa are queues, where ov[head] is the most recent position.
			// v is just a temp variable here, not really velocity
			v.zero ();
			tempValue.plus (oa[head  ], oa[head + 7]);
			v.plusa (v, 22081.0 / 15120.0, tempValue);
			tempValue.plus (oa[head + 1], oa[head + 6]);
			v.plusa (v, -7337.0 / 15120.0, tempValue);
			tempValue.plus (oa[head + 2], oa[head + 5]);
			v.plusa (v, 45765.0 / 15120.0, tempValue);
			tempValue.plus (oa[head + 3], oa[head + 4]);
			v.plusa (v, -29.0 / 15120.0, tempValue);
			v.scale (inc * inc);
			v.plus (v, ov[head + 7]);
			p.plus (p, v);
		}

		/**
		 * velocity - estimate the velocity at time [head+POINTS/2] in v
		 */
		public function velocity (inc:Number, tempValue:Point):void
		{
			// Here are some increasingly accurate velocity estimates:
			//  1/2
			// -1/12,    2/3
			//  1/60,   -3/20,   3/4
			// -1/280,   4/105, -1/5,   4/5
			//  1/1260, -5/504,  5/84, -5/21,   5/6
			// -1/5544,  1/385, -1/56,  3/38, -15/56, 6/7
			v.zero ();
			tempValue.plus (ov[head + 3], ov[head + 4]);   // temp = op[3]-op[5]
			v.plusa (v, (4.0 / 5.0) / inc, tempValue);
			tempValue.plus (tempValue, ov[head + 2]);
			tempValue.plus (tempValue, ov[head + 5]);         // temp = op[2]-op[6]
			v.plusa (v, (-1.0 / 5.0) / inc, tempValue);
			tempValue.plus (tempValue, ov[head + 1]);
			tempValue.plus (tempValue, ov[head + 6]);         // temp = op[1]-op[7]
			v.plusa (v, (4.0 / 105.0) / inc, tempValue);
			tempValue.plus (tempValue, ov[head + 0]);
			tempValue.plus (tempValue, ov[head + 7]);         // temp = op[0]-op[8]
			v.plusa (v, (-1.0 / 280.0) / inc, tempValue);
		}

		/*
		 * Remove jitter from this moon's path.
		 * Use "rescale" to shrink the stepsize.
		 */
		public function dejitter (rescale:Number, increment:Number, polyIn:BVector, poly:BVector, polyAccel:Vector.<Point>, polyPosition:Vector.<Point>):void
		{
			// Put the acceleration polynomial in polyAccel
			for (var i:int = 0; i < dejit.length; ++i)
			{polyIn.set (i, oa[head + i].x);}
			dejit.makeInterpolator (poly, polyIn);
			for (var i:int = 0; i < dejit.length; ++i)
			{polyAccel[i].x = poly.get (i);}

			for (var i:int = 0; i < dejit.length; ++i)
			{polyIn.set (i, oa[head + i].y);}
			dejit.makeInterpolator (poly, polyIn);
			for (var i:int = 0; i < dejit.length; ++i)
			{polyAccel[i].y = poly.get (i);}

			for (var i:int = 0; i < dejit.length; ++i)
			{polyIn.set (i, oa[head + i].z);}
			dejit.makeInterpolator (poly, polyIn);
			for (var i:int = 0; i < dejit.length; ++i)
			{polyAccel[i].z = poly.get (i);}

			// Integrate polyAccel twice to get the polyPosition
			polyPosition[0].zero ();
			polyPosition[1].zero ();
			for (var i:int = 0; i < dejit.length; ++i)
			{
				polyPosition[i + 2].copy (polyAccel[i]);
				polyPosition[i + 2].scale (increment * increment / ((i + 1) * (i + 2)));
			}

			// determine velocity, put it in polyPosition[1]
			nov[head].eval (polyPosition, dejit.offset);
			nov[head + PERIOD].eval (polyPosition, PERIOD + dejit.offset);
			polyPosition[1].plus (polyPosition[1], nov[head]);
			polyPosition[1].minus (polyPosition[1], nov[head + PERIOD]);
			v.zero ();
			for (var i:int = 0; i < PERIOD; ++i)
			{
				v.plus (v, ov[head + i]);
			}
			polyPosition[1].minus (polyPosition[1], v);
			polyPosition[1].scale (1.0 / PERIOD);

			// fill nov[0..POINTS-1], accounting for velocity
			nov[head].eval (polyPosition, dejit.offset);
			for (var i:int = 1; i < POINTS; ++i)
			{
				nov[head + i].eval (polyPosition, i + dejit.offset);
				nov[head + i - 1].minus (nov[head + i - 1], nov[head + i]);
			}

			// adjust the position
			polyPosition[0].zero ();   // this will be the sum of positions
			v.zero ();                 // v will be the current position
			for (var i:int = 0; i < PERIOD - 1; ++i)
			{
				v.plus (v, nov[head + i]);
				polyPosition[0].plus (polyPosition[0], v);
			}
			v.zero ();
			for (var i:int = 0; i < PERIOD - 1; ++i)
			{
				v.plus (v, ov[head + i]);
				polyPosition[0].minus (polyPosition[0], v);
			}
			polyPosition[0].scale (1.0 / PERIOD);

			// Evaluate and rescale positions
			if (rescale != 1.0)
			{
				//System.out.println("Dejitter rescale: Not implemented!!!");
			}
			else
			{
				// adjust positions
				p.plus (p, polyPosition[0]);
				var tv:Vector.<Point> = ov;
				ov = nov;
				nov = tv;
			}
		}
	}
}
