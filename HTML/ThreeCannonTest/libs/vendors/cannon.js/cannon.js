/*
 * Copyright (c) 2012 cannon.js Authors
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function () {
/**
 * @page About
 * cannon.js is a lightweight 3D physics engine for web applications. For more information and source code, go to the Github repository [schteppe/cannon.js](https://github.com/schteppe/cannon.js).
 */

/**
 * @library cannon.js
 * @version 0.4.3
 * @brief A lightweight 3D physics engine for the web
 */

var CANNON = CANNON || {};

// Maintain compatibility with older browsers
// @todo: check so ordinary Arrays work.
if(!this.Int32Array){
  this.Int32Array=Array;
  this.Float32Array=Array;
}/*global CANNON:true */

/**
 * @class CANNON.Broadphase
 * @author schteppe
 * @brief Base class for broadphase implementations
 */
CANNON.Broadphase = function(){
    /**
    * @property CANNON.World world
    * @brief The world to search for collisions in.
    * @memberof CANNON.Broadphase
    */
    this.world = null;
};
CANNON.Broadphase.prototype.constructor = CANNON.BroadPhase;

/**
 * @method collisionPairs
 * @memberof CANNON.Broadphase
 * @brief Get the collision pairs from the world
 * @param CANNON.World world The world to search in
 * @return array An array with two subarrays of body indices
 */
CANNON.Broadphase.prototype.collisionPairs = function(world){
    throw "collisionPairs not implemented for this BroadPhase class!";
};

/*global CANNON:true */

/**
 * @class CANNON.NaiveBroadphase
 * @brief Naive broadphase implementation, used in lack of better ones.
 * @description The naive broadphase looks at all possible pairs without restriction, therefore it has complexity N^2 (which is bad)
 * @extends CANNON.Broadphase
 */
 CANNON.NaiveBroadphase = function(){
    this.temp = {
        r: new CANNON.Vec3(),
        normal: new CANNON.Vec3(),
        quat: new CANNON.Quaternion(),
        relpos : new CANNON.Vec3(),
    };
};
CANNON.NaiveBroadphase.prototype = new CANNON.Broadphase();
CANNON.NaiveBroadphase.prototype.constructor = CANNON.NaiveBroadphase;

/**
 * @method collisionPairs
 * @memberof CANNON.NaiveBroadphase
 * @brief Get all the collision pairs in the physics world
 * @param CANNON.World world
 * @return array An array containing two arrays of integers. The integers corresponds to the body indices.
 */
 CANNON.NaiveBroadphase.prototype.collisionPairs = function(world){
    var pairs1 = [], pairs2 = [];
    var n = world.numObjects(),
    bodies = world.bodies;

    // Local fast access
    var types = CANNON.Shape.types;
    var BOX_SPHERE_COMPOUND_CONVEX = types.SPHERE | types.BOX | types.COMPOUND | types.CONVEXPOLYHEDRON,
        PLANE = types.PLANE,
        STATIC_OR_KINEMATIC = CANNON.Body.STATIC | CANNON.Body.KINEMATIC;

    // Temp vecs
    var temp = this.temp;
    var r = temp.r,
    normal = temp.normal,
    quat = temp.quat,
    relpos = temp.relpos;

    // Naive N^2 ftw!
    for(var i=0; i<n; i++){
        for(var j=0; j<i; j++){
            var bi = bodies[i], bj = bodies[j];

            if(((bi.motionstate & STATIC_OR_KINEMATIC)!==0 || bi.isSleeping()) &&
               ((bj.motionstate & STATIC_OR_KINEMATIC)!==0 || bj.isSleeping())) {
                // Both bodies are static, kinematic or sleeping. Skip.
                continue;
            }

            var bishape = bi.shape, bjshape = bj.shape;
            if(bishape && bjshape){
                var ti = bishape.type, tj = bjshape.type;

                // --- Box / sphere / compound / convexpolyhedron collision ---
                if((ti & BOX_SPHERE_COMPOUND_CONVEX) && (tj & BOX_SPHERE_COMPOUND_CONVEX)){
                    // Rel. position
                    bj.position.vsub(bi.position,r);

                    var boundingRadiusSum = bishape.boundingSphereRadius() + bjshape.boundingSphereRadius();
                    if(r.norm2()<boundingRadiusSum*boundingRadiusSum){
                        pairs1.push(bi);
                        pairs2.push(bj);
                    }

                    // --- Sphere/box/compound/convexpoly versus plane ---
                } else if((ti & BOX_SPHERE_COMPOUND_CONVEX) && (tj & types.PLANE) || (tj & BOX_SPHERE_COMPOUND_CONVEX) && (ti & types.PLANE)){
                    var pi = (ti===PLANE) ? i : j, // Plane
                    oi = (ti!==PLANE) ? i : j; // Other
                    
                    // Rel. position
                    bodies[oi].position.vsub(bodies[pi].position,r);
                    normal.set(0,0,1);
                    bodies[pi].quaternion.vmult(normal,normal);
                    
                    var q = r.dot(normal) - bodies[oi].shape.boundingSphereRadius();
                    if(q<0.0){
                        pairs1.push(bi);
                        pairs2.push(bj);
                    }
                }
            } else {
                // Particle without shape
                if(!bishape && !bjshape){
                    // No collisions between 2 particles
                } else {
                    var particle = bishape ? bj : bi;
                    var other = bishape ? bi : bj;
                    var otherShape = other.shape;
                    var type = otherShape.type;

                    if(type & BOX_SPHERE_COMPOUND_CONVEX){
                        // todo: particle vs box,sphere,compound,convex
                        if(type === types.SPHERE){
                            particle.position.vsub(other.position,relpos);
                            if(Math.pow(otherShape.radius,2) >= relpos.norm2()){
                                pairs1.push(particle);
                                pairs2.push(other);
                            }
                        }
                    } else if(type & types.PLANE){
                        // particle/plane
                        var plane = other;
                        plane.quaternion.vmult(normal,normal);
                        particle.position.vsub(plane.position,relpos);
                        if(normal.dot(relpos)<=0.0){
                            pairs1.push(particle);
                            pairs2.push(other);
                        }
                    }
                }
            }
        }
    }
    return [pairs1,pairs2];
};
/*global CANNON:true */

/**
 * @class CANNON.Ray
 * @author Originally written by mr.doob / http://mrdoob.com/ for Three.js. Cannon.js-ified by schteppe.
 * @brief A line in 3D space that intersects bodies and return points.
 * @param CANNON.Vec3 origin
 * @param CANNON.Vec3 direction
 */
CANNON.Ray = function(origin, direction){
    /**
    * @property CANNON.Vec3 origin
    * @memberof CANNON.Ray
    */
    this.origin = origin || new CANNON.Vec3();

    /**
    * @property CANNON.Vec3 direction
    * @memberof CANNON.Ray
    */
    this.direction = direction || new CANNON.Vec3();

    var precision = 0.0001;

    /**
     * @method setPrecision
     * @memberof CANNON.Ray
     * @param float value
     * @brief Sets the precision of the ray. Used when checking parallelity etc.
     */
    this.setPrecision = function ( value ) {
        precision = value;
    };

    var a = new CANNON.Vec3();
    var b = new CANNON.Vec3();
    var c = new CANNON.Vec3();
    var d = new CANNON.Vec3();

    var directionCopy = new CANNON.Vec3();

    var vector = new CANNON.Vec3();
    var normal = new CANNON.Vec3();
    var intersectPoint = new CANNON.Vec3()

    /**
     * @method intersectBody
     * @memberof CANNON.Ray
     * @param CANNON.RigidBody body
     * @brief Shoot a ray at a body, get back information about the hit.
     * @return Array An array of results. The result objects has properties: distance (float), point (CANNON.Vec3) and body (CANNON.RigidBody).
     */
    this.intersectBody = function ( body ) {
        if(body.shape instanceof CANNON.ConvexPolyhedron){
            return this.intersectShape(body.shape,
                                       body.quaternion,
                                       body.position,
                                       body);
        } else if(body.shape instanceof CANNON.Box){
            return this.intersectShape(body.shape.convexPolyhedronRepresentation,
                                       body.quaternion,
                                       body.position,
                                       body);
        } else
            console.warn("Ray intersection is this far only implemented for ConvexPolyhedron and Box shapes.");
    };
    
    /**
     * @method intersectShape
     * @memberof CANNON.Ray
     * @param CANNON.Shape shape
     * @param CANNON.Quaternion quat
     * @param CANNON.Vec3 position
     * @param CANNON.RigidBody body
     * @return Array See intersectBody()
     */
    this.intersectShape = function(shape,quat,position,body){

        var intersect, intersects = [];

        if ( shape instanceof CANNON.ConvexPolyhedron ) {
            // Checking boundingSphere

            var distance = distanceFromIntersection( this.origin, this.direction, position );
            if ( distance > shape.boundingSphereRadius() ) {
                return intersects;
            }

            // Checking faces
            var dot, scalar, faces = shape.faces, vertices = shape.vertices, normals = shape.faceNormals;


            for ( fi = 0; fi < faces.length; fi++ ) {

                var face = faces[ fi ];
                var faceNormal = normals[ fi ];
                var q = quat;
                var x = position;

                // determine if ray intersects the plane of the face
                // note: this works regardless of the direction of the face normal

                // Get plane point in world coordinates...
                vertices[face[0]].copy(vector);
                q.vmult(vector,vector);
                vector.vadd(x,vector);

                // ...but make it relative to the ray origin. We'll fix this later.
                vector.vsub(this.origin,vector);

                // Get plane normal
                q.vmult(faceNormal,normal);

                // If this dot product is negative, we have something interesting
                dot = this.direction.dot(normal);
                
                // bail if ray and plane are parallel
                if ( Math.abs( dot ) < precision ) continue;

                // calc distance to plane
                scalar = normal.dot( vector ) / dot;

                // if negative distance, then plane is behind ray
                if ( scalar < 0 ) continue;

                if (  dot < 0 ) {

                    // Intersection point is origin + direction * scalar
                    this.direction.mult(scalar,intersectPoint);
                    intersectPoint.vadd(this.origin,intersectPoint);

                    // a is the point we compare points b and c with.
                    vertices[ face[0] ].copy(a);
                    q.vmult(a,a);
                    x.vadd(a,a);

                    for(var i=1; i<face.length-1; i++){
                        // Transform 3 vertices to world coords
                        vertices[ face[i] ].copy(b);
                        vertices[ face[i+1] ].copy(c);
                        q.vmult(b,b);
                        q.vmult(c,c);
                        x.vadd(b,b);
                        x.vadd(c,c);
                        
                        if ( pointInTriangle( intersectPoint, a, b, c ) ) {

                            intersect = {

                                distance: this.origin.distanceTo( intersectPoint ),
                                point: intersectPoint.copy(),
                                face: face,
                                body: body
                            
                            };
                            
                            intersects.push( intersect );
                            break;
                        }
                    }
                }
            }
        }
        return intersects;
    }

    /**
     * @method intersectBodies
     * @memberof CANNON.Ray
     * @param Array bodies An array of CANNON.RigidBody objects.
     * @return Array See intersectBody
     */
    this.intersectBodies = function ( bodies ) {

        var intersects = [];

        for ( var i = 0, l = bodies.length; i < l; i ++ ) {
            var result = this.intersectBody( bodies[ i ] );
            Array.prototype.push.apply( intersects, result );
        }

        intersects.sort( function ( a, b ) { return a.distance - b.distance; } );
        return intersects;
    };

    var v0 = new CANNON.Vec3(), intersect = new CANNON.Vec3();
    var dot, distance;

    function distanceFromIntersection( origin, direction, position ) {

        // v0 is vector from origin to position
        position.vsub(origin,v0);
        dot = v0.dot( direction );

        // intersect = direction*dot + origin
        direction.mult(dot,intersect);
        intersect.vadd(origin,intersect);
        
        distance = position.distanceTo( intersect );

        return distance;
    }

    // http://www.blackpawn.com/texts/pointinpoly/default.html

    var dot00, dot01, dot02, dot11, dot12, invDenom, u, v;
    var v1 = new CANNON.Vec3(), v2 = new CANNON.Vec3();

    function pointInTriangle( p, a, b, c ) {
        c.vsub(a,v0);
        b.vsub(a,v1);
        p.vsub(a,v2);

        dot00 = v0.dot( v0 );
        dot01 = v0.dot( v1 );
        dot02 = v0.dot( v2 );
        dot11 = v1.dot( v1 );
        dot12 = v1.dot( v2 );

        invDenom = 1 / ( dot00 * dot11 - dot01 * dot01 );
        u = ( dot11 * dot02 - dot01 * dot12 ) * invDenom;
        v = ( dot00 * dot12 - dot01 * dot02 ) * invDenom;

        return ( u >= 0 ) && ( v >= 0 ) && ( u + v < 1 );
    }
};
CANNON.Ray.prototype.constructor = CANNON.Ray;
/*global CANNON:true */

/**
 * @class CANNON.Mat3
 * @brief A 3x3 matrix.
 * @param array elements Array of nine elements. Optional.
 * @author schteppe / http://github.com/schteppe
 */
CANNON.Mat3 = function(elements){
    /**
    * @property Array elements
    * @memberof CANNON.Mat3
    * @brief A vector of length 9, containing all matrix elements
    * The values in the array are stored in the following order:
    * | 0 1 2 |
    * | 3 4 5 |
    * | 6 7 8 |
    * 
    */
    if(elements){
        this.elements = elements;
    } else {
        this.elements = [0,0,0,0,0,0,0,0,0];
    }
};

/**
 * @method identity
 * @memberof CANNON.Mat3
 * @brief Sets the matrix to identity
 * @todo Should perhaps be renamed to setIdentity() to be more clear.
 * @todo Create another function that immediately creates an identity matrix eg. eye()
 */
CANNON.Mat3.prototype.identity = function(){
    this.elements[0] = 1;
    this.elements[1] = 0;
    this.elements[2] = 0;

    this.elements[3] = 0;
    this.elements[4] = 1;
    this.elements[5] = 0;

    this.elements[6] = 0;
    this.elements[7] = 0;
    this.elements[8] = 1;
};

CANNON.Mat3.prototype.setZero = function(){
    var e = this.elements;
    e[0] = 0;
    e[1] = 0;
    e[2] = 0;
    e[3] = 0;
    e[4] = 0;
    e[5] = 0;
    e[6] = 0;
    e[7] = 0;
    e[8] = 0;
};

/**
 * @method setTrace
 * @memberof CANNON.Mat3
 * @brief Sets the matrix diagonal elements from a Vec3
 */
CANNON.Mat3.prototype.setTrace = function(vec3){
    this.elements[0] = vec3.x;
    this.elements[4] = vec3.y;
    this.elements[8] = vec3.z;
};

/**
 * @method vmult
 * @memberof CANNON.Mat3
 * @brief Matrix-Vector multiplication
 * @param CANNON.Vec3 v The vector to multiply with
 * @param CANNON.Vec3 target Optional, target to save the result in.
 */
CANNON.Mat3.prototype.vmult = function(v,target){
    target = target || new CANNON.Vec3();

    var vec = [v.x, v.y, v.z];
    var targetvec = [0, 0, 0];
    for(var i=0; i<3; i++){
        for(var j=0; j<3; j++){
          targetvec[j] += this.elements[i+3*j]*vec[i];
        }
    }

    target.x = targetvec[0];
    target.y = targetvec[1];
    target.z = targetvec[2];
    return target;
};

/**
 * @method smult
 * @memberof CANNON.Mat3
 * @brief Matrix-scalar multiplication
 * @param float s
 */
CANNON.Mat3.prototype.smult = function(s){
    for(var i=0; i<this.elements.length; i++){
        this.elements[i] *= s;
    }
};

/**
 * @method mmult
 * @memberof CANNON.Mat3
 * @brief Matrix multiplication
 * @param CANNON.Mat3 m Matrix to multiply with from left side.
 * @return CANNON.Mat3 The result.
 */
CANNON.Mat3.prototype.mmult = function(m){
    var r = new CANNON.Mat3();
    for(var i=0; i<3; i++){
    for(var j=0; j<3; j++){
        var sum = 0.0;
        for(var k=0; k<3; k++){
        sum += m.elements[i+k*3] * this.elements[k+j*3];
        }
        r.elements[i+j*3] = sum;
    }
    }
    return r;
};

/**
 * @method solve
 * @memberof CANNON.Mat3
 * @brief Solve Ax=b
 * @param CANNON.Vec3 b The right hand side
 * @param CANNON.Vec3 target Optional. Target vector to save in.
 * @return CANNON.Vec3 The solution x
 */
CANNON.Mat3.prototype.solve = function(b,target){

    target = target || new CANNON.Vec3();

    // Construct equations
    var nr = 3; // num rows
    var nc = 4; // num cols
    var eqns = [];
    for(var i=0; i<nr*nc; i++) eqns.push(0);
    var i,j;
    for(i=0; i<3; i++){
        for(j=0; j<3; j++){
            eqns[i+nc*j] = this.elements[i+3*j];
        }
    }
    eqns[3+4*0] = b.x;
    eqns[3+4*1] = b.y;
    eqns[3+4*2] = b.z;

    // Compute right upper triangular version of the matrix - Gauss elimination
    var n = 3, k = n, np;
    var kp = 4; // num rows
    var p, els;
do {
    i = k - n;
    if (eqns[i+nc*i] === 0) {
        // the pivot is null, swap lines
      for (j = i + 1; j < k; j++) {
        if (eqns[i+nc*j] !== 0) {
          np = kp;
          do {  // do ligne( i ) = ligne( i ) + ligne( k )
            p = kp - np;
            eqns[p+nc*i] += eqns[p+nc*j]; 
          } while (--np);
          break;
        }
      }
    }
    if (eqns[i+nc*i] !== 0) {
      for (j = i + 1; j < k; j++) {
        var multiplier = eqns[i+nc*j] / eqns[i+nc*i];
        np = kp;
        do {  // do ligne( k ) = ligne( k ) - multiplier * ligne( i )
          p = kp - np;
          eqns[p+nc*j] = p <= i ? 0 : eqns[p+nc*j] - eqns[p+nc*i] * multiplier ;
        } while (--np);
      }
    }
  } while (--n);

    // Get the solution
    target.z = eqns[2*nc+3] / eqns[2*nc+2];
    target.y = (eqns[1*nc+3] - eqns[1*nc+2]*target.z) / eqns[1*nc+1];
    target.x = (eqns[0*nc+3] - eqns[0*nc+2]*target.z - eqns[0*nc+1]*target.y) / eqns[0*nc+0];

    if(isNaN(target.x) || isNaN(target.y) || isNaN(target.z) || target.x===Infinity || target.y===Infinity || target.z===Infinity){
        throw "Could not solve equation! Got x=["+target.toString()+"], b=["+b.toString()+"], A=["+this.toString()+"]";
    }

    return target;
};

/**
 * @method e
 * @memberof CANNON.Mat3
 * @brief Get an element in the matrix by index. Index starts at 0, not 1!!!
 * @param int row 
 * @param int column
 * @param float value Optional. If provided, the matrix element will be set to this value.
 * @return float
 */
CANNON.Mat3.prototype.e = function( row , column ,value){
    if(value===undefined){
    return this.elements[column+3*row];
    } else {
    // Set value
    this.elements[column+3*row] = value;
    }
};

/**
 * @method copy
 * @memberof CANNON.Mat3
 * @brief Copy the matrix
 * @param CANNON.Mat3 target Optional. Target to save the copy in.
 * @return CANNON.Mat3
 */
CANNON.Mat3.prototype.copy = function(target){
    target = target || new CANNON.Mat3();
    for(var i=0; i<this.elements.length; i++){
        target.elements[i] = this.elements[i];
    }
    return target;
};

/**
 * @method toString
 * @memberof CANNON.Mat3
 * @brief Returns a string representation of the matrix.
 * @return string
 */
CANNON.Mat3.prototype.toString = function(){
    var r = "";
    var sep = ",";
    for(var i=0; i<9; i++){
        r += this.elements[i] + sep;
    }
    return r;
};

/**
 * @method reverse
 * @memberof CANNON.Mat3
 * @brief reverse the matrix
 * @param CANNON.Mat3 target Optional. Target matrix to save in.
 * @return CANNON.Mat3 The solution x
 */
CANNON.Mat3.prototype.reverse = function(target){

    target = target || new CANNON.Mat3();

  // Construct equations
    var nr = 3; // num rows
    var nc = 6; // num cols
    var eqns = [];
    for(var i=0; i<nr*nc; i++) eqns.push(0);
    var i,j;
    for(i=0; i<3; i++){
        for(j=0; j<3; j++){
            eqns[i+nc*j] = this.elements[i+3*j];
        }
    }
    eqns[3+6*0] = 1;
    eqns[3+6*1] = 0;
    eqns[3+6*2] = 0;
    eqns[4+6*0] = 0;
    eqns[4+6*1] = 1;
    eqns[4+6*2] = 0;
    eqns[5+6*0] = 0;
    eqns[5+6*1] = 0;
    eqns[5+6*2] = 1;
  
  // Compute right upper triangular version of the matrix - Gauss elimination
    var n = 3, k = n, np;
    var kp = nc; // num rows
    var p;
    do {
    i = k - n;
    if (eqns[i+nc*i] === 0) {
        // the pivot is null, swap lines
        for (j = i + 1; j < k; j++) {
        if (eqns[i+nc*j] !== 0) {
            np = kp;
            do { // do line( i ) = line( i ) + line( k )
            p = kp - np;
            eqns[p+nc*i] += eqns[p+nc*j];
            } while (--np);
            break;
        }
        }
    }
    if (eqns[i+nc*i] !== 0) {
        for (j = i + 1; j < k; j++) {
        var multiplier = eqns[i+nc*j] / eqns[i+nc*i];
        np = kp;
        do { // do line( k ) = line( k ) - multiplier * line( i )
            p = kp - np;
            eqns[p+nc*j] = p <= i ? 0 : eqns[p+nc*j] - eqns[p+nc*i] * multiplier ;
        } while (--np);
        }
    }
    } while (--n);
  
  // eliminate the upper left triangle of the matrix
  i = 2
    do {
    j = i-1;
    do {
        var multiplier = eqns[i+nc*j] / eqns[i+nc*i];
        np = nc;
        do { 
        p = nc - np;
        eqns[p+nc*j] =  eqns[p+nc*j] - eqns[p+nc*i] * multiplier ;
        } while (--np);
    } while (j--);
    } while (--i);
  
  // operations on the diagonal
    i = 2;
    do {
    var multiplier = 1 / eqns[i+nc*i];
    np = nc;
    do { 
        p = nc - np;
        eqns[p+nc*i] = eqns[p+nc*i] * multiplier ;
    } while (--np);
    } while (i--);
  
  
    i = 2;
    do {
    j = 2;
    do {
        p = eqns[nr+j+nc*i];
        if( isNaN( p ) || p ===Infinity )
        throw "Could not reverse! A=["+this.toString()+"]";
        target.e( i , j , p );
    } while (j--);
    } while (i--);
    
    return target;
};/*global CANNON:true */

/**
 * @class CANNON.Vec3
 * @brief 3-dimensional vector
 * @param float x
 * @param float y
 * @param float z
 * @author schteppe
 */
CANNON.Vec3 = function(x,y,z){
    /**
    * @property float x
    * @memberof CANNON.Vec3
    */
    this.x = x||0.0;
    /**
    * @property float y
    * @memberof CANNON.Vec3
    */
    this.y = y||0.0;
    /**
    * @property float z
    * @memberof CANNON.Vec3
    */
    this.z = z||0.0;
};

/**
 * @method cross
 * @memberof CANNON.Vec3
 * @brief Vector cross product
 * @param CANNON.Vec3 v
 * @param CANNON.Vec3 target Optional. Target to save in.
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.cross = function(v,target){
    var vx=v.x, vy=v.y, vz=v.z, x=this.x, y=this.y, z=this.z;
    target = target || new CANNON.Vec3();

    var A = [this.x, this.y, this.z];
    var B = [v.x, v.y, v.z];
    
    /*target.x = (A[1] * B[2]) - (A[2] * B[1]);
    target.y = (A[2] * B[0]) - (A[0] * B[2]);
    target.z = (A[0] * B[1]) - (A[1] * B[0]);*/
    target.x = (y * vz) - (z * vy);
    target.y = (z * vx) - (x * vz);
    target.z = (x * vy) - (y * vx);
    
    return target;
};

/**
 * @method set
 * @memberof CANNON.Vec3
 * @brief Set the vectors' 3 elements
 * @param float x
 * @param float y
 * @param float z
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.set = function(x,y,z){
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
};
    
/**
 * @method vadd
 * @memberof CANNON.Vec3
 * @brief Vector addition
 * @param CANNON.Vec3 v
 * @param CANNON.Vec3 target Optional.
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.vadd = function(v,target){
    if(target){
        target.x = v.x + this.x;
        target.y = v.y + this.y;
        target.z = v.z + this.z;
    } else {
        return new CANNON.Vec3(this.x + v.x,
                               this.y + v.y,
                               this.z + v.z);
    }  
};
    
/**
 * @method vsub
 * @memberof CANNON.Vec3
 * @brief Vector subtraction
 * @param CANNON.Vec3 v
 * @param CANNON.Vec3 target Optional. Target to save in.
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.vsub = function(v,target){
    if(target){
        target.x = this.x - v.x;
        target.y = this.y - v.y;
        target.z = this.z - v.z;
    } else {
        return new CANNON.Vec3(this.x-v.x,
                               this.y-v.y,
                               this.z-v.z);
    }
};

/**
 * @method crossmat
 * @memberof CANNON.Vec3
 * @brief Get the cross product matrix a_cross from a vector, such that a x b = a_cross * b = c
 * @see http://www8.cs.umu.se/kurser/TDBD24/VT06/lectures/Lecture6.pdf
 * @return CANNON.Mat3
 */
CANNON.Vec3.prototype.crossmat = function(){
    return new CANNON.Mat3([     0,  -this.z,   this.y,
                            this.z,        0,  -this.x,
                           -this.y,   this.x,        0]);
};

/**
 * @method normalize
 * @memberof CANNON.Vec3
 * @brief Normalize the vector. Note that this changes the values in the vector.
 * @return float Returns the norm of the vector
 */
CANNON.Vec3.prototype.normalize = function(){
    var x=this.x, y=this.y, z=this.z;
    var n = Math.sqrt(x*x + y*y + z*z);
    if(n>0.0){
        var invN = 1/n;
        this.x *= invN;
        this.y *= invN;
        this.z *= invN;
    } else {
        // Make something up
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }
    return n;
};

/**
 * @method unit
 * @memberof CANNON.Vec3
 * @brief Get the version of this vector that is of length 1.
 * @param CANNON.Vec3 target Optional target to save in
 * @return CANNON.Vec3 Returns the unit vector
 */
CANNON.Vec3.prototype.unit = function(target){
    target = target || new CANNON.Vec3();
    var x=this.x, y=this.y, z=this.z;
    var ninv = Math.sqrt(x*x + y*y + z*z);
    if(ninv>0.0){
        ninv = 1.0/ninv;
        target.x = x * ninv;
        target.y = y * ninv;
        target.z = z * ninv;
    } else {
        target.x = 0;
        target.y = 0;
        target.z = 0;
    }
    return target;
};

/**
 * @method norm
 * @memberof CANNON.Vec3
 * @brief Get the 2-norm (length) of the vector
 * @return float
 */
CANNON.Vec3.prototype.norm = function(){
    var x=this.x, y=this.y, z=this.z;
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * @method norm2
 * @memberof CANNON.Vec3
 * @brief Get the squared length of the vector
 * @return float
 */
CANNON.Vec3.prototype.norm2 = function(){
    return this.dot(this);
};

CANNON.Vec3.prototype.distanceTo = function(p){
    var x=this.x, y=this.y, z=this.z;
    var px=p.x, py=p.y, pz=p.z;
    return Math.sqrt((px-x)*(px-x)+
                     (py-y)*(py-y)+
                     (pz-z)*(pz-z));
};

/**
 * @method mult
 * @memberof CANNON.Vec3
 * @brief Multiply the vector with a scalar
 * @param float scalar
 * @param CANNON.Vec3 target
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.mult = function(scalar,target){
    if(!target)
        target = new CANNON.Vec3();
    target.x = scalar*this.x;
    target.y = scalar*this.y;
    target.z = scalar*this.z;
    return target;
};

/**
 * @method dot
 * @memberof CANNON.Vec3
 * @brief Calculate dot product
 * @param CANNON.Vec3 v
 * @return float
 */
CANNON.Vec3.prototype.dot = function(v){
    return (this.x * v.x + this.y * v.y + this.z * v.z);
};

/**
 * @method isZero
 * @memberof CANNON.Vec3
 * @return bool
 */
CANNON.Vec3.prototype.isZero = function(){
    return this.x===0 && this.y===0 && this.z===0;
}

/**
 * @method negate
 * @memberof CANNON.Vec3
 * @brief Make the vector point in the opposite direction.
 * @param CANNON.Vec3 target Optional target to save in
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.negate = function(target){
    target = target || new CANNON.Vec3();
    target.x = -this.x;
    target.y = -this.y;
    target.z = -this.z;
    return target;
};

/**
 * @method tangents
 * @memberof CANNON.Vec3
 * @brief Compute two artificial tangents to the vector
 * @param CANNON.Vec3 t1 Vector object to save the first tangent in
 * @param CANNON.Vec3 t2 Vector object to save the second tangent in
 */
CANNON.Vec3.prototype.tangents = function(t1,t2){
    var norm = this.norm();
    if(norm>0.0){
        var n = new CANNON.Vec3(this.x/norm,
                                this.y/norm,
                                this.z/norm);
        if(n.x<0.9){
            var rand = Math.random();
            n.cross(new CANNON.Vec3(rand,0.0000001,0).unit(),t1);
        } else
            n.cross(new CANNON.Vec3(0.0000001,rand,0).unit(),t1);
        n.cross(t1,t2);
    } else {
        // The normal length is zero, make something up
        t1.set(1,0,0).normalize();
        t2.set(0,1,0).normalize();
    }
};

/**
 * @method toString
 * @memberof CANNON.Vec3
 * @brief Converts to a more readable format
 * @return string
 */
CANNON.Vec3.prototype.toString = function(){
    return this.x+","+this.y+","+this.z;
};

/**
 * @method copy
 * @memberof CANNON.Vec3
 * @brief Copy the vector.
 * @param CANNON.Vec3 target
 * @return CANNON.Vec3
 */
CANNON.Vec3.prototype.copy = function(target){
    target = target || new CANNON.Vec3();
    target.x = this.x;
    target.y = this.y;
    target.z = this.z;
    return target;
};


/**
 * @method lerp
 * @memberof CANNON.Vec3
 * @brief Do a linear interpolation between two vectors
 * @param CANNON.Vec3 v
 * @param float t A number between 0 and 1. 0 will make this function return u, and 1 will make it return v. Numbers in between will generate a vector in between them.
 * @param CANNON.Vec3 target
 */
CANNON.Vec3.prototype.lerp = function(v,t,target){
    var x=this.x, y=this.y, z=this.z;
    target.x = x + (v.x-x)*t;
    target.y = y + (v.y-y)*t;
    target.z = z + (v.z-z)*t;
};

/**
 * @method almostEquals
 * @memberof CANNON.Vec3
 * @brief Check if a vector equals is almost equal to another one.
 * @param CANNON.Vec3 v
 * @param float precision
 * @return bool
 */
CANNON.Vec3.prototype.almostEquals = function(v,precision){
    if(precision===undefined)
        precision = 1e-6;
    if( Math.abs(this.x-v.x)>precision ||
        Math.abs(this.y-v.y)>precision ||
        Math.abs(this.z-v.z)>precision)
        return false;
    return true;
}

/**
 * @method almostZero
 * @brief Check if a vector is almost zero
 * @param float precision
 * @memberof CANNON.Vec3
 */
CANNON.Vec3.prototype.almostZero = function(precision){
    if(precision===undefined)
        precision = 1e-6;
    if( Math.abs(this.x)>precision ||
        Math.abs(this.y)>precision ||
        Math.abs(this.z)>precision)
        return false;
    return true;
}/*global CANNON:true */

/**
 * @class CANNON.Quaternion
 * @brief A Quaternion describes a rotation in 3D space.
 * @description The Quaternion is mathematically defined as Q = x*i + y*j + z*k + w, where (i,j,k) are imaginary basis vectors. (x,y,z) can be seen as a vector related to the axis of rotation, while the real multiplier, w, is related to the amount of rotation.
 * @param float x Multiplier of the imaginary basis vector i.
 * @param float y Multiplier of the imaginary basis vector j.
 * @param float z Multiplier of the imaginary basis vector k.
 * @param float w Multiplier of the real part.
 * @see http://en.wikipedia.org/wiki/Quaternion
 */
CANNON.Quaternion = function(x,y,z,w){
    /**
    * @property float x
    * @memberof CANNON.Quaternion
    */
    this.x = x!=undefined ? x : 0;
    /**
    * @property float y
    * @memberof CANNON.Quaternion
    */
    this.y = y!=undefined ? y : 0;
    /**
    * @property float z
    * @memberof CANNON.Quaternion
    */
    this.z = z!=undefined ? z : 0;
    /**
    * @property float w
    * @memberof CANNON.Quaternion
    * @brief The multiplier of the real quaternion basis vector.
    */
    this.w = w!=undefined ? w : 1;
};

/**
 * @method set
 * @memberof CANNON.Quaternion
 * @brief Set the value of the quaternion.
 * @param float x
 * @param float y
 * @param float z
 * @param float w
 */
CANNON.Quaternion.prototype.set = function(x,y,z,w){
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
};

/**
 * @method toString
 * @memberof CANNON.Quaternion
 * @brief Convert to a readable format
 * @return string
 */
CANNON.Quaternion.prototype.toString = function(){
    return this.x+","+this.y+","+this.z+","+this.w;
};

/**
 * @method setFromAxisAngle
 * @memberof CANNON.Quaternion
 * @brief Set the quaternion components given an axis and an angle.
 * @param CANNON.Vec3 axis
 * @param float angle in radians
 */
CANNON.Quaternion.prototype.setFromAxisAngle = function(axis,angle){
    var s = Math.sin(angle*0.5);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(angle*0.5);
};

// saves axis to targetAxis and returns 
CANNON.Quaternion.prototype.toAxisAngle = function(targetAxis){
    targetAxis = targetAxis || new CANNON.Vec3();
    this.normalize(); // if w>1 acos and sqrt will produce errors, this cant happen if quaternion is normalised
    var angle = 2 * Math.acos(this.w);
    var s = Math.sqrt(1-this.w*this.w); // assuming quaternion normalised then w is less than 1, so term always positive.
    if (s < 0.001) { // test to avoid divide by zero, s is always positive due to sqrt
        // if s close to zero then direction of axis not important
        targetAxis.x = this.x; // if it is important that axis is normalised then replace with x=1; y=z=0;
        targetAxis.y = this.y;
        targetAxis.z = this.z;
    } else {
        targetAxis.x = this.x / s; // normalise axis
        targetAxis.y = this.y / s;
        targetAxis.z = this.z / s;
    }
    return [targetAxis,angle];
};

/**
 * @method setFromVectors
 * @memberof CANNON.Quaternion
 * @brief Set the quaternion value given two vectors. The resulting rotation will be the needed rotation to rotate u to v.
 * @param CANNON.Vec3 u
 * @param CANNON.Vec3 v
 */
CANNON.Quaternion.prototype.setFromVectors = function(u,v){
    var a = u.cross(v);
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    this.w = Math.sqrt(Math.pow(u.norm(),2) * Math.pow(v.norm(),2)) + u.dot(v);
    this.normalize();
};

/**
 * @method mult
 * @memberof CANNON.Quaternion
 * @brief Quaternion multiplication
 * @param CANNON.Quaternion q
 * @param CANNON.Quaternion target Optional.
 * @return CANNON.Quaternion
 */ 
var va = new CANNON.Vec3();
var vb = new CANNON.Vec3();
var vaxvb = new CANNON.Vec3();
CANNON.Quaternion.prototype.mult = function(q,target){
    var w = this.w;
    if(target==undefined)
        target = new CANNON.Quaternion();
    
    va.set(this.x,this.y,this.z);
    vb.set(q.x,q.y,q.z);
    target.w = w*q.w - va.dot(vb);
    va.cross(vb,vaxvb);
    target.x = w * vb.x + q.w*va.x + vaxvb.x;
    target.y = w * vb.y + q.w*va.y + vaxvb.y;
    target.z = w * vb.z + q.w*va.z + vaxvb.z;
    return target;
};

/**
 * @method inverse
 * @memberof CANNON.Quaternion
 * @brief Get the inverse quaternion rotation.
 * @param CANNON.Quaternion target
 * @return CANNON.Quaternion
 */
CANNON.Quaternion.prototype.inverse = function(target){
    var x = this.x, y = this.y, z = this.z, w = this.w;
    if(target==undefined)
        target = new CANNON.Quaternion();
    
    this.conjugate(target);
    var inorm2 = 1/(x*x + y*y + z*z + w*w);
    target.x *= inorm2;
    target.y *= inorm2;
    target.z *= inorm2;
    target.w *= inorm2;
    
    return target;
};

/**
 * @method conjugate
 * @memberof CANNON.Quaternion
 * @brief Get the quaternion conjugate
 * @param CANNON.Quaternion target
 * @return CANNON.Quaternion
 */
CANNON.Quaternion.prototype.conjugate = function(target){
    if(target==undefined)
        target = new CANNON.Quaternion();

    target.x = -this.x;
    target.y = -this.y;
    target.z = -this.z;
    target.w = this.w;

    return target;
};

/**
 * @method normalize
 * @memberof CANNON.Quaternion
 * @brief Normalize the quaternion. Note that this changes the values of the quaternion.
 */
CANNON.Quaternion.prototype.normalize = function(){
    var l = Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w);
    if ( l === 0 ) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;
    } else {
        l = 1 / l;
        this.x *= l;
        this.y *= l;
        this.z *= l;
        this.w *= l;
    }
};

/**
 * @method normalizeFast
 * @memberof CANNON.Quaternion
 * @brief Approximation of quaternion normalization. Works best when quat is already almost-normalized.
 * @see http://jsperf.com/fast-quaternion-normalization
 * @author unphased, https://github.com/unphased
 */
CANNON.Quaternion.prototype.normalizeFast = function () {
    var f = (3.0-(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w))/2.0;
    if ( f === 0 ) {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;
    } else {
        this.x *= f;
        this.y *= f;
        this.z *= f;
        this.w *= f;
    }
}

/**
 * @method vmult
 * @memberof CANNON.Quaternion
 * @brief Multiply the quaternion by a vector
 * @param CANNON.Vec3 v
 * @param CANNON.Vec3 target Optional
 * @return CANNON.Vec3
 */
CANNON.Quaternion.prototype.vmult = function(v,target){
    target = target || new CANNON.Vec3();
    if(this.w==0.0){
        target.x = v.x;
        target.y = v.y;
        target.z = v.z;
    } else {

        var x = v.x,
        y = v.y,
        z = v.z;

        var qx = this.x,
        qy = this.y,
        qz = this.z,
        qw = this.w;

        // q*v
        var ix =  qw * x + qy * z - qz * y,
        iy =  qw * y + qz * x - qx * z,
        iz =  qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

        target.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        target.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        target.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    }

    return target;
};

/**
 * @method copy
 * @memberof CANNON.Quaternion
 * @param CANNON.Quaternion target
 */
CANNON.Quaternion.prototype.copy = function(target){
    target.x = this.x;
    target.y = this.y;
    target.z = this.z;
    target.w = this.w;
};

/**
 * @method toEuler
 * @memberof CANNON.Quaternion
 * @brief Convert the quaternion to euler angle representation. Order: YZX, as this page describes: http://www.euclideanspace.com/maths/standards/index.htm
 * @param CANNON.Vec3 target
 * @param string order Three-character string e.g. "YZX", which also is default.
 */
CANNON.Quaternion.prototype.toEuler = function(target,order){
    order = order || "YZX";

    var heading, attitude, bank;
    var x = this.x, y = this.y, z = this.z, w = this.w;

    switch(order){
    case "YZX":
        var test = x*y + z*w;
        if (test > 0.499) { // singularity at north pole
            heading = 2 * Math.atan2(x,w);
            attitude = Math.PI/2;
            bank = 0;
        }
        if (test < -0.499) { // singularity at south pole
            heading = -2 * Math.atan2(x,w);
            attitude = - Math.PI/2;
            bank = 0;
        }
        if(isNaN(heading)){
            var sqx = x*x;
            var sqy = y*y;
            var sqz = z*z;
            heading = Math.atan2(2*y*w - 2*x*z , 1 - 2*sqy - 2*sqz); // Heading
            attitude = Math.asin(2*test); // attitude
            bank = Math.atan2(2*x*w - 2*y*z , 1 - 2*sqx - 2*sqz); // bank
        }
        break;
    default:
        throw new Error("Euler order "+order+" not supported yet.");
        break;
    }

    target.y = heading;
    target.z = attitude;
    target.x = bank;
};/*global CANNON:true */

/**
 * @class CANNON.Shape
 * @author schteppe
 * @brief Base class for shapes
 * @todo Should have a mechanism for caching bounding sphere radius instead of calculating it each time
 */
CANNON.Shape = function(){

    /**
     * @property int type
     * @memberof CANNON.Shape
     * @brief The type of this shape. Must be set to an int > 0 by subclasses.
     * @see CANNON.Shape.types
     */
    this.type = 0;

    // Local AABB's
    this.aabbmin = new CANNON.Vec3();
    this.aabbmax = new CANNON.Vec3();
};
CANNON.Shape.prototype.constructor = CANNON.Shape;

/**
 * @method boundingSphereRadius
 * @memberof CANNON.Shape
 * @brief Get the bounding sphere radius from this shape
 * @return float
 */
CANNON.Shape.prototype.boundingSphereRadius = function(){
  throw "boundingSphereRadius() not implemented for shape type "+this.type;
};

/**
 * @method volume
 * @memberof CANNON.Shape
 * @brief Get the volume of this shape
 * @return float
 */
CANNON.Shape.prototype.volume = function(){
    throw "volume() not implemented for shape type "+this.type;
};

/**
 * @method calculateLocalInertia
 * @memberof CANNON.Shape
 * @brief Calculates the inertia in the local frame for this shape.
 * @return CANNON.Vec3
 * @see http://en.wikipedia.org/wiki/List_of_moments_of_inertia
 */
CANNON.Shape.prototype.calculateLocalInertia = function(mass,target){
  throw "calculateLocalInertia() not implemented for shape type "+this.type;
};

/**
 * @method calculateTransformedInertia
 * @memberof CANNON.Shape
 * @brief Calculates inertia in a specified frame for this shape.
 * @return CANNON.Vec3
 */
CANNON.Shape.prototype.calculateTransformedInertia = function(mass,quat,target){
  if(target==undefined)
    target = new CANNON.Vec3();

  // Compute inertia in the world frame
  quat.normalize();
  var localInertia = new CANNON.Vec3();
  this.calculateLocalInertia(mass,localInertia);

  // @todo Is this rotation OK? Check!
  var worldInertia = quat.vmult(localInertia);
  target.x = Math.abs(worldInertia.x);
  target.y = Math.abs(worldInertia.y);
  target.z = Math.abs(worldInertia.z);
  return target;
  //throw "calculateInertia() not implemented for shape type "+this.type;
};

// Calculates the local aabb and sets the result to .aabbmax and .aabbmin
CANNON.Shape.calculateLocalAABB = function(){
    throw new Error(".calculateLocalAABB is not implemented for this Shape yet!");
};

/**
 * @property Object types
 * @memberof CANNON.Shape
 * @brief The available shape types.
 */
CANNON.Shape.types = {
  SPHERE:1,
  PLANE:2,
  BOX:4,
  COMPOUND:8,
  CONVEXPOLYHEDRON:16
};

/*global CANNON:true */

/**
 * @class CANNON.Body
 * @brief Base class for all body types.
 * @param string type
 * @extends CANNON.EventTarget
 */
CANNON.Body = function(type){

    CANNON.EventTarget.apply(this);

    this.type = type;

    var that = this;

    /**
    * @property CANNON.World world
    * @memberof CANNON.Body
    * @brief Reference to the world the body is living in
    */
    this.world = null;

    /**
    * @property function preStep
    * @memberof CANNON.Body
    * @brief Callback function that is used BEFORE stepping the system. Use it to apply forces, for example. Inside the function, "this" will refer to this CANNON.Body object.
    * @todo dispatch an event from the World instead
    */
    this.preStep = null;

    /**
    * @property function postStep
    * @memberof CANNON.Body
    * @brief Callback function that is used AFTER stepping the system. Inside the function, "this" will refer to this CANNON.Body object.
    * @todo dispatch an event from the World instead
    */
    this.postStep = null;

    this.vlambda = new CANNON.Vec3();
};

/*
 * @brief A dynamic body is fully simulated. Can be moved manually by the user, but normally they move according to forces. A dynamic body can collide with all body types. A dynamic body always has finite, non-zero mass.
 */
CANNON.Body.DYNAMIC = 1;

/*
 * @brief A static body does not move during simulation and behaves as if it has infinite mass. Static bodies can be moved manually by setting the position of the body. The velocity of a static body is always zero. Static bodies do not collide with other static or kinematic bodies.
 */
CANNON.Body.STATIC = 2;

/*
 * A kinematic body moves under simulation according to its velocity. They do not respond to forces. They can be moved manually, but normally a kinematic body is moved by setting its velocity. A kinematic body behaves as if it has infinite mass. Kinematic bodies do not collide with other static or kinematic bodies.
 */
CANNON.Body.KINEMATIC = 4;/*global CANNON:true */

/**
 * @class CANNON.Particle
 * @brief A body consisting of one point mass. Does not have orientation.
 * @param float mass
 * @param CANNON.Material material
 */
CANNON.Particle = function(mass,material){

    // Check input
    if(typeof(mass)!="number")
        throw new Error("Argument 1 (mass) must be a number.");
    if(typeof(material)!="undefined" && !(material instanceof(CANNON.Material)))
        throw new Error("Argument 3 (material) must be an instance of CANNON.Material.");

    CANNON.Body.call(this,"particle");

    var that = this;

    /**
    * @property CANNON.Vec3 position
    * @memberof CANNON.Particle
    */
    this.position = new CANNON.Vec3();

    /**
    * @property CANNON.Vec3 initPosition
    * @memberof CANNON.Particle
    * @brief Initial position of the body
    */
    this.initPosition = new CANNON.Vec3();

    /**
    * @property CANNON.Vec3 velocity
    * @memberof CANNON.Particle
    */
    this.velocity = new CANNON.Vec3();

    /**
    * @property CANNON.Vec3 initVelocity
    * @memberof CANNON.Particle
    */
    this.initVelocity = new CANNON.Vec3();

    /**
    * @property CANNON.Vec3 force
    * @memberof CANNON.Particle
    * @brief Linear force on the body
    */
    this.force = new CANNON.Vec3();

    /**
    * @property float mass
    * @memberof CANNON.Particle
    */
    this.mass = mass;

    /**
    * @property float invMass
    * @memberof CANNON.Particle
    */
    this.invMass = mass>0 ? 1.0/mass : 0;

    /**
    * @property CANNON.Material material
    * @memberof CANNON.Particle
    */
    this.material = material;

    /**
    * @property float linearDamping
    * @memberof CANNON.Particle
    */
    this.linearDamping = 0.01; // Perhaps default should be zero here?

    /**
    * @property int motionstate
    * @memberof CANNON.Particle
    * @brief One of the states CANNON.Body.DYNAMIC, CANNON.Body.STATIC and CANNON.Body.KINEMATIC
    */
    this.motionstate = (mass <= 0.0 ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC);

    /**
    * @property bool allowSleep
    * @memberof CANNON.Particle
    * @brief If true, the body will automatically fall to sleep.
    */
    this.allowSleep = true;

    // 0:awake, 1:sleepy, 2:sleeping
    var sleepState = 0;

    /**
    * @method isAwake
    * @memberof CANNON.Particle
    * @return bool
    */
    this.isAwake = function(){ return sleepState == 0; }

    /**
    * @method isSleepy
    * @memberof CANNON.Particle
    * @return bool
    */
    this.isSleepy = function(){ return sleepState == 1; }

    /**
    * @method isSleeping
    * @memberof CANNON.Particle
    * @return bool
    */
    this.isSleeping = function(){ return sleepState == 2; }

    /**
    * @property float sleepSpeedLimit
    * @memberof CANNON.Particle
    * @brief If the speed (the norm of the velocity) is smaller than this value, the body is considered sleepy.
    */
    this.sleepSpeedLimit = 0.1;

    /**
    * @property float sleepTimeLimit
    * @memberof CANNON.Particle
    * @brief If the body has been sleepy for this sleepTimeLimit milliseconds, it is considered sleeping.
    */
    this.sleepTimeLimit = 1000;
    var timeLastSleepy = new Date().getTime();

    /**
    * @method wakeUp
    * @memberof CANNON.Particle
    * @brief Wake the body up.
    */
    this.wakeUp = function(){
        sleepState = 0;
        that.dispatchEvent({type:"wakeup"});
    };

    /**
    * @method sleep
    * @memberof CANNON.Particle
    * @brief Force body sleep
    */
    this.sleep = function(){
        sleepState = 2;
    };

    /**
    * @method sleepTick
    * @memberof CANNON.Particle
    * @brief Called every timestep to update internal sleep timer and change sleep state if needed.
    */
    this.sleepTick = function(){
        if(that.allowSleep){
          if(sleepState==0 && that.velocity.norm()<that.sleepSpeedLimit){
              sleepState = 1; // Sleepy
              timeLastSleepy = new Date().getTime();
              that.dispatchEvent({type:"sleepy"});
          } else if(sleepState==1 && that.velocity.norm()>that.sleepSpeedLimit){
              that.wakeUp(); // Wake up
          } else if(sleepState==1 && (new Date().getTime() - timeLastSleepy)>that.sleepTimeLimit){
              sleepState = 2; // Sleeping
              that.dispatchEvent({type:"sleep"});
          }
        }
    };
};
/*global CANNON:true */

/**
 * @class CANNON.RigidBody
 * @brief Rigid body base class
 * @param float mass
 * @param CANNON.Shape shape
 * @param CANNON.Material material
 */
CANNON.RigidBody = function(mass,shape,material){

    // Check input
    if(typeof(mass)!="number")
    throw new Error("Argument 1 (mass) must be a number.");
    if(typeof(material)!="undefined" && !(material instanceof(CANNON.Material)))
    throw new Error("Argument 3 (material) must be an instance of CANNON.Material.");

    CANNON.Particle.call(this,mass,material);

    var that = this;

    /**
     * @property CANNON.Vec3 tau
     * @memberof CANNON.RigidBody
     * @brief Rotational force on the body, around center of mass
     */
    this.tau = new CANNON.Vec3();

    /**
     * @property CANNON.Quaternion quaternion
     * @memberof CANNON.RigidBody
     * @brief Orientation of the body
     */
    this.quaternion = new CANNON.Quaternion();

    /**
     * @property CANNON.Quaternion initQuaternion
     * @memberof CANNON.RigidBody
     */
    this.initQuaternion = new CANNON.Quaternion();

    /**
     * @property CANNON.Vec3 angularVelocity
     * @memberof CANNON.RigidBody
     */
    this.angularVelocity = new CANNON.Vec3();

    /**
     * @property CANNON.Vec3 initAngularVelocity
     * @memberof CANNON.RigidBody
     */
    this.initAngularVelocity = new CANNON.Vec3();

    /**
     * @property CANNON.Shape shape
     * @memberof CANNON.RigidBody
     */
    this.shape = shape;

    /**
     * @property CANNON.Vec3 inertia
     * @memberof CANNON.RigidBody
     */
    this.inertia = new CANNON.Vec3();
    shape.calculateLocalInertia(mass,this.inertia);

    this.inertiaWorld = new CANNON.Vec3();
    this.inertia.copy(this.inertiaWorld);
    this.inertiaWorldAutoUpdate = false;

    /**
     * @property CANNON.Vec3 intInertia
     * @memberof CANNON.RigidBody
     */
    this.invInertia = new CANNON.Vec3(this.inertia.x>0 ? 1.0/this.inertia.x : 0,
                                      this.inertia.y>0 ? 1.0/this.inertia.y : 0,
                                      this.inertia.z>0 ? 1.0/this.inertia.z : 0);
    this.invInertiaWorld = new CANNON.Vec3();
    this.invInertia.copy(this.invInertiaWorld);
    this.invInertiaWorldAutoUpdate = false;

    /**
     * @property float angularDamping
     * @memberof CANNON.RigidBody
     */
    this.angularDamping = 0.01; // Perhaps default should be zero here?

    /**
     * @property CANNON.Vec3 aabbmin
     * @memberof CANNON.RigidBody
     */
    this.aabbmin = new CANNON.Vec3();

    /**
     * @property CANNON.Vec3 aabbmax
     * @memberof CANNON.RigidBody
     */
    this.aabbmax = new CANNON.Vec3();

    this.calculateAABB();

    this.wlambda = new CANNON.Vec3();
};

CANNON.RigidBody.constructor = CANNON.RigidBody;

CANNON.RigidBody.prototype.calculateAABB = function(){
    this.shape.calculateWorldAABB(this.position,
                  this.quaternion,
                  this.aabbmin,
                  this.aabbmax);
};

CANNON.RigidBody.prototype.applyImpulse = function(worldPoint,force,dt){
    dt = dt || 1/60;
    var r=new CANNON.Vec3(), rotForce=new CANNON.Vec3();
    worldPoint.vsub(this.position,r);
    r.cross(force,rotForce);
    this.velocity.vadd(force.mult(dt),this.velocity);
    this.angularVelocity.vadd(rotForce.mult(dt),this.angularVelocity);
};/*global CANNON:true */

/**
 * @brief Spherical rigid body
 * @class CANNON.Sphere
 * @extends CANNON.Shape
 * @param float radius
 * @author schteppe / http://github.com/schteppe
 */
CANNON.Sphere = function(radius){
    CANNON.Shape.call(this);

    /**
     * @property float radius
     * @memberof CANNON.Sphere
     */
    this.radius = radius!=undefined ? Number(radius) : 1.0;
    this.type = CANNON.Shape.types.SPHERE;
};
CANNON.Sphere.prototype = new CANNON.Shape();
CANNON.Sphere.prototype.constructor = CANNON.Sphere;

CANNON.Sphere.prototype.calculateLocalInertia = function(mass,target){
    target = target || new CANNON.Vec3();
    var I = 2.0*mass*this.radius*this.radius/5.0;
    target.x = I;
    target.y = I;
    target.z = I;
    return target;
};

CANNON.Sphere.prototype.volume = function(){
    return 4.0 * Math.PI * this.radius / 3.0;
};

CANNON.Sphere.prototype.boundingSphereRadius = function(){
    return this.radius;
};

CANNON.Sphere.prototype.calculateWorldAABB = function(pos,quat,min,max){
    var r = this.radius;
    var axes = ['x','y','z'];
    for(var i=0; i<axes.length; i++){
        var ax = axes[i];
        min[ax] = pos[ax] - r;
        max[ax] = pos[ax] + r;
    }
};/*global CANNON:true */

/**
 * @class CANNON.Box
 * @brief A 3d box shape.
 * @param CANNON.Vec3 halfExtents
 * @author schteppe
 * @extends CANNON.Shape
 */
CANNON.Box = function(halfExtents){
    CANNON.Shape.call(this);

    /**
    * @property CANNON.Vec3 halfExtents
    * @memberof CANNON.Box
    */
    this.halfExtents = halfExtents;
    this.type = CANNON.Shape.types.BOX;

    /**
    * @property CANNON.ConvexPolyhedron convexPolyhedronRepresentation
    * @brief Used by the contact generator to make contacts with other convex polyhedra for example
    * @memberof CANNON.Box
    */
    this.convexPolyhedronRepresentation = null;

    this.updateConvexPolyhedronRepresentation();
};
CANNON.Box.prototype = new CANNON.Shape();
CANNON.Box.prototype.constructor = CANNON.Box;

/**
 * @method updateConvexPolyhedronRepresentation
 * @memberof CANNON.Box
 * @brief Updates the local convex polyhedron representation used for some collisions.
 */
CANNON.Box.prototype.updateConvexPolyhedronRepresentation = function(){
    var sx = this.halfExtents.x;
    var sy = this.halfExtents.y;
    var sz = this.halfExtents.z;
    var v = CANNON.Vec3;
    var h = new CANNON.ConvexPolyhedron([new v(-sx,-sy,-sz),
                                         new v( sx,-sy,-sz),
                                         new v( sx, sy,-sz),
                                         new v(-sx, sy,-sz),
                                         new v(-sx,-sy, sz),
                                         new v( sx,-sy, sz),
                                         new v( sx, sy, sz),
                                         new v(-sx, sy, sz)],
                                        
                                        [
                                            [0,1,2,3], // -z
                                            [4,5,6,7], // +z
                                            [0,1,4,5], // -y
                                            [2,3,6,7], // +y
                                            [0,3,4,7], // -x
                                            [1,2,5,6], // +x
                                        ],
                                        
                                        [new v( 0, 0,-1),
                                         new v( 0, 0, 1),
                                         new v( 0,-1, 0),
                                         new v( 0, 1, 0),
                                         new v(-1, 0, 0),
                                         new v( 1, 0, 0)]);
    this.convexPolyhedronRepresentation = h;
};

CANNON.Box.prototype.calculateLocalInertia = function(mass,target){
  target = target || new CANNON.Vec3();
  target.x = 1.0 / 12.0 * mass * (   2*this.halfExtents.y*2*this.halfExtents.y + 2*this.halfExtents.z*2*this.halfExtents.z );
  target.y = 1.0 / 12.0 * mass * (   2*this.halfExtents.x*2*this.halfExtents.x + 2*this.halfExtents.z*2*this.halfExtents.z );
  target.z = 1.0 / 12.0 * mass * (   2*this.halfExtents.y*2*this.halfExtents.y + 2*this.halfExtents.x*2*this.halfExtents.x );
  return target;
};

/**
 * @method getCorners
 * @memberof CANNON.Box
 * @brief Get the box corners
 * @param CANNON.Quaternion quat Orientation to apply to the corner vectors. If not provided, the vectors will be in respect to the local frame.
 * @return array
 */
CANNON.Box.prototype.getCorners = function(quat){
    var corners = [];
    var ex = this.halfExtents;
    corners.push(new CANNON.Vec3(  ex.x,  ex.y,  ex.z));
    corners.push(new CANNON.Vec3( -ex.x,  ex.y,  ex.z));
    corners.push(new CANNON.Vec3( -ex.x, -ex.y,  ex.z));
    corners.push(new CANNON.Vec3( -ex.x, -ex.y, -ex.z));
    corners.push(new CANNON.Vec3(  ex.x, -ex.y, -ex.z));
    corners.push(new CANNON.Vec3(  ex.x,  ex.y, -ex.z));
    corners.push(new CANNON.Vec3( -ex.x,  ex.y, -ex.z));
    corners.push(new CANNON.Vec3(  ex.x, -ex.y,  ex.z));

    for(var i=0; quat!=undefined && i<corners.length; i++)
        quat.vmult(corners[i],corners[i]);

    return corners;
};


/**
 * @method getSideNormals
 * @memberof CANNON.Box
 * @brief Get the box 6 side normals
 * @param bool includeNegative If true, this function returns 6 vectors. If false, it only returns 3 (but you get 6 by reversing those 3)
 * @param CANNON.Quaternion quat Orientation to apply to the normal vectors. If not provided, the vectors will be in respect to the local frame.
 * @return array
 */
CANNON.Box.prototype.getSideNormals = function(includeNegative,quat){
    var sides = [];
    var ex = this.halfExtents;
    sides.push(new CANNON.Vec3(  ex.x,     0,     0));
    sides.push(new CANNON.Vec3(     0,  ex.y,     0));
    sides.push(new CANNON.Vec3(     0,     0,  ex.z));
    if(includeNegative!=undefined && includeNegative){
        sides.push(new CANNON.Vec3( -ex.x,     0,     0));
        sides.push(new CANNON.Vec3(     0, -ex.y,     0));
        sides.push(new CANNON.Vec3(     0,     0, -ex.z));
    }

    if(quat!=undefined){
        for(var i=0; i<sides.length; i++)
            quat.vmult(sides[i],sides[i]);
    }

    return sides;
};

CANNON.Box.prototype.volume = function(){
    return 8.0 * this.halfExtents.x * this.halfExtents.y * this.halfExtents.z;
};

CANNON.Box.prototype.boundingSphereRadius = function(){
    return this.halfExtents.norm();
};

var worldCornerTempPos = new CANNON.Vec3();
var worldCornerTempNeg = new CANNON.Vec3();
CANNON.Box.prototype.forEachWorldCorner = function(pos,quat,callback){

    var e = this.halfExtents;
    var corners = [[  e.x,  e.y,  e.z],
                   [ -e.x,  e.y,  e.z],
                   [ -e.x, -e.y,  e.z],
                   [ -e.x, -e.y, -e.z],
                   [  e.x, -e.y, -e.z],
                   [  e.x,  e.y, -e.z],
                   [ -e.x,  e.y, -e.z],
                   [  e.x, -e.y,  e.z]];
           
    for(var i=0; i<corners.length; i++){
        worldCornerTempPos.set(corners[i][0],corners[i][1],corners[i][2]);
        quat.vmult(worldCornerTempPos,worldCornerTempPos);
        pos.vadd(worldCornerTempPos,worldCornerTempPos);
        callback(worldCornerTempPos.x,
                 worldCornerTempPos.y,
                 worldCornerTempPos.z);
    }
};

CANNON.Box.prototype.calculateWorldAABB = function(pos,quat,min,max){
    // Get each axis max
    min.set(Infinity,Infinity,Infinity);
    max.set(-Infinity,-Infinity,-Infinity);
    this.forEachWorldCorner(pos,quat,function(x,y,z){

        if(x > max.x) max.x = x;
        if(y > max.y) max.y = y;
        if(z > max.z) max.z = z;

        if(x < min.x) min.x = x;
        if(y < min.y) min.y = y;
        if(z < min.z) min.z = z;

    });    
};/*global CANNON:true */

/**
 * @class CANNON.Plane
 * @extends CANNON.Shape
 * @param CANNON.Vec3 normal
 * @brief A plane, facing in the Z direction.
 * @description A plane, facing in the Z direction. The plane has its surface at z=0 and everything below z=0 is assumed to be solid plane. To make the plane face in some other direction than z, you must put it inside a RigidBody and rotate that body. See the demos.
 * @author schteppe
 */
CANNON.Plane = function(){
    CANNON.Shape.call(this);
    this.type = CANNON.Shape.types.PLANE;
};
CANNON.Plane.prototype = new CANNON.Shape();
CANNON.Plane.prototype.constructor = CANNON.Plane;

CANNON.Plane.prototype.calculateLocalInertia = function(mass,target){
    target = target || new CANNON.Vec3();
    return target;
};

CANNON.Plane.prototype.volume = function(){
    return Infinity; // The plane is infinite...
};

var tempNormal = new CANNON.Vec3(0,0,1);
CANNON.Plane.prototype.calculateWorldAABB = function(pos,quat,min,max){
    // The plane AABB is infinite, except if the normal is pointing along any axis
    quat.vmult(tempNormal,tempNormal);
    min.set(Infinity,Infinity,Infinity);
    var axes = ['x','y','z'];
    for(var i=0; i<axes.length; i++){
        var ax = axes[i];
        if(tempNormal[ax]==1)
            max[ax] = pos[ax];
        if(tempNormal[ax]==-1)
            min[ax] = pos[ax];
    }
};/*global CANNON:true */

/**
 * @class CANNON.Compound
 * @extends CANNON.Shape
 * @brief A shape made of several other shapes.
 * @author schteppe
 */
CANNON.Compound = function(){
    CANNON.Shape.call(this);
    this.type = CANNON.Shape.types.COMPOUND;
    this.childShapes = [];
    this.childOffsets = [];
    this.childOrientations = [];
};
CANNON.Compound.prototype = new CANNON.Shape();
CANNON.Compound.prototype.constructor = CANNON.Compound;

/**
 * @method addChild
 * @memberof CANNON.Compound
 * @brief Add a child shape.
 * @param CANNON.Shape shape
 * @param CANNON.Vec3 offset
 * @param CANNON.Quaternion orientation
 */
CANNON.Compound.prototype.addChild = function(shape,offset,orientation){
    offset = offset || new CANNON.Vec3();
    orientation = orientation || new CANNON.Quaternion();
    this.childShapes.push(shape);
    this.childOffsets.push(offset);
    this.childOrientations.push(orientation);
};

CANNON.Compound.prototype.volume = function(){
    var r = 0.0;
    for(var i = 0; i<this.childShapes.length; i++)
        r += this.childShapes[i].volume();
    return r;
};

CANNON.Compound.prototype.calculateLocalInertia = function(mass,target){
    target = target || new CANNON.Vec3();

    // Calculate the total volume, we will spread out this objects' mass on the sub shapes
    var V = this.volume();

    for(var i = 0; i<this.childShapes.length; i++){
        // Get child information
        var b = this.childShapes[i];
        var o = this.childOffsets[i];
        var q = this.childOrientations[i];
        var m = b.volume() / V * mass;

        // Get the child inertia, transformed relative to local frame
        var inertia = b.calculateTransformedInertia(m,q);

        // Add its inertia using the parallel axis theorem, i.e.
        // I += I_child;    
        // I += m_child * r^2

        target.vadd(inertia,target);
        var mr2 = new CANNON.Vec3(m*o.x*o.x,
                                  m*o.y*o.y,
                                  m*o.z*o.z);
        target.vadd(mr2,target);
    }
    return target;
};

CANNON.Compound.prototype.boundingSphereRadius = function(){
    var r = 0.0;
    for(var i = 0; i<this.childShapes.length; i++){
        var candidate = this.childOffsets[i].norm() + this.childShapes[i].boundingSphereRadius();
        if(r < candidate)
            r = candidate;
    }
    return r;
};

var aabbmaxTemp = new CANNON.Vec3();
var aabbminTemp = new CANNON.Vec3();
var childPosTemp = new CANNON.Vec3();
var childQuatTemp = new CANNON.Vec3();
CANNON.Compound.prototype.calculateWorldAABB = function(pos,quat,min,max){
    var N=this.childShapes.length;
    min.set(Infinity,Infinity,Infinity);
    max.set(-Infinity,-Infinity,-Infinity);
    // Get each axis max
    for(var i=0; i<N; i++){

        // Accumulate transformation to child
        this.childOffsets[i].copy(childPosTemp);
        quat.vmult(childPosTemp,childPosTemp);
        pos.vadd(childPosTemp,childPosTemp);
        //quat.mult(this.childOrientations[i],childQuatTemp);

        // Get child AABB
        this.childShapes[i].calculateWorldAABB(childPosTemp,
                                               this.childOrientations[i],
                                               aabbminTemp,
                                               aabbmaxTemp);

        if(aabbminTemp.x < min.x) min.x = aabbminTemp.x;
        if(aabbminTemp.y < min.y) min.y = aabbminTemp.y;
        if(aabbminTemp.z < min.z) min.z = aabbminTemp.z;
        
        if(aabbmaxTemp.x > max.x) max.x = aabbmaxTemp.x;
        if(aabbmaxTemp.y > max.y) max.y = aabbmaxTemp.y;
        if(aabbmaxTemp.z > max.z) max.z = aabbmaxTemp.z;
    }
};/**
 * @class CANNON.ConvexPolyhedron
 * @extends CANNON.Shape
 * @brief A set of points in space describing a convex shape.
 * @author qiao / https://github.com/qiao (original author, see https://github.com/qiao/three.js/commit/85026f0c769e4000148a67d45a9e9b9c5108836f)
 * @author schteppe / https://github.com/schteppe
 * @see http://www.altdevblogaday.com/2011/05/13/contact-generation-between-3d-convex-meshes/
 * @see http://bullet.googlecode.com/svn/trunk/src/BulletCollision/NarrowPhaseCollision/btPolyhedralContactClipping.cpp
 * @todo move the clipping functions to ContactGenerator?
 * @param array points An array of CANNON.Vec3's
 */
CANNON.ConvexPolyhedron = function( points , faces , normals ) {
    var that = this;
    CANNON.Shape.call( this );
    this.type = CANNON.Shape.types.CONVEXPOLYHEDRON;

    /**
    * @property array vertices
    * @memberof CANNON.ConvexPolyhedron
    * @brief Array of CANNON.Vec3
    */
    this.vertices = points||[];

    /**
    * @property array faces
    * @memberof CANNON.ConvexPolyhedron
    * @brief Array of integer arrays, indicating which vertices each face consists of
    * @todo Needed?
    */
    this.faces = faces||[];

    /**
     * @property array faceNormals
     * @memberof CANNON.ConvexPolyhedron
     * @brief Array of CANNON.Vec3
     * @todo Needed?
     */
    this.faceNormals = normals||[];

    /**
     * @property array uniqueEdges
     * @memberof CANNON.ConvexPolyhedron
     * @brief Array of CANNON.Vec3
     */
    this.uniqueEdges = [];
    var nv = this.vertices.length;
    for(var pi=0; pi<nv; pi++){
        var p = this.vertices[pi];
        if(!(p instanceof CANNON.Vec3)){
            throw "Argument 1 must be instance of CANNON.Vec3";
            return false;
        }
        this.vertices.push(p);
    }

    for(var i=0; i<this.faces.length; i++){
        var numVertices = this.faces[i].length;
        var NbTris = numVertices;
        for(var j=0; j<NbTris; j++){
            var k = ( j+1 ) % numVertices;
            var edge = new CANNON.Vec3();
            this.vertices[this.faces[i][j]].vsub(this.vertices[this.faces[i][k]],edge);
            edge.normalize();
            var found = false;
            for(var p=0;p<this.uniqueEdges.length;p++){
                if (this.uniqueEdges[p].almostEquals(edge) || 
                    this.uniqueEdges[p].almostEquals(edge)){
                found = true;
                break;
                }
            }

            if (!found){
                this.uniqueEdges.push(edge);
            }

            if (edge) {
                edge.face1 = i;
            } else {
                var ed;
                ed.m_face0 = i;
                edges.insert(vp,ed);
            }
        }
    }

    /*
     * Get max and min dot product of a convex hull at position (pos,quat) projected onto an axis. Results are saved in the array maxmin.
     * @param CANNON.ConvexPolyhedron hull
     * @param CANNON.Vec3 axis
     * @param CANNON.Vec3 pos
     * @param CANNON.Quaternion quat
     * @param array maxmin maxmin[0] and maxmin[1] will be set to maximum and minimum, respectively.
     */
    var worldVertex = new CANNON.Vec3();
    function project(hull,axis,pos,quat,maxmin){
        var n = hull.vertices.length;
        var max = null;
        var min = null;
        var vs = hull.vertices;
        for(var i=0; i<n; i++){
            vs[i].copy(worldVertex);
            quat.vmult(worldVertex,worldVertex);
            worldVertex.vadd(pos,worldVertex);
            var val = worldVertex.dot(axis);
            if(max===null || val>max)
                max = val;
            if(min===null || val<min)
                min = val;
        }

        if(min>max){
            // Inconsistent - swap
            var temp = min;
            min = max;
            max = temp;
        }
    
        // Output
        maxmin[0] = max;
        maxmin[1] = min;
    }

    /**
     * @method testSepAxis
     * @memberof CANNON.ConvexPolyhedron
     * @brief Test separating axis against two hulls. Both hulls are projected onto the axis and the overlap size is returned if there is one.
     * @param CANNON.Vec3 axis
     * @param CANNON.ConvexPolyhedron hullB
     * @param CANNON.Vec3 posA
     * @param CANNON.Quaternion quatA
     * @param CANNON.Vec3 posB
     * @param CANNON.Quaternion quatB
     * @return float The overlap depth, or FALSE if no penetration.
     */
    this.testSepAxis = function(axis, hullB, posA, quatA, posB, quatB){
        var maxminA=[], maxminB=[], hullA=this;
        project(hullA, axis, posA, quatA, maxminA);
        project(hullB, axis, posB, quatB, maxminB);
        var maxA = maxminA[0];
        var minA = maxminA[1];
        var maxB = maxminB[0];
        var minB = maxminB[1];
        if(maxA<minB || maxB<minA){
            //console.log(minA,maxA,minB,maxB);
            return false; // Separated
        }
        
        var d0 = maxA - minB;
        var d1 = maxB - minA;
        depth = d0<d1 ? d0:d1;
        return depth;
    }

    /**
     * @method findSeparatingAxis
     * @memberof CANNON.ConvexPolyhedron
     * @brief Find the separating axis between this hull and another
     * @param CANNON.ConvexPolyhedron hullB
     * @param CANNON.Vec3 posA
     * @param CANNON.Quaternion quatA
     * @param CANNON.Vec3 posB
     * @param CANNON.Quaternion quatB
     * @param CANNON.Vec3 target The target vector to save the axis in
     * @return bool Returns false if a separation is found, else true
     */
    var faceANormalWS3 = new CANNON.Vec3();
    var Worldnormal1 = new CANNON.Vec3(); 
    var deltaC = new CANNON.Vec3();
    var worldEdge0 = new CANNON.Vec3();
    var worldEdge1 = new CANNON.Vec3();
    var Cross = new CANNON.Vec3();
    this.findSeparatingAxis = function(hullB,posA,quatA,posB,quatB,target){
        var dmin = Infinity;
        var hullA = this;
        var curPlaneTests=0;
        var numFacesA = hullA.faces.length;

        // Test normals from hullA
        for(var i=0; i<numFacesA; i++){
            // Get world face normal
            hullA.faceNormals[i].copy(faceANormalWS3);
            quatA.vmult(faceANormalWS3,faceANormalWS3);
            //posA.vadd(faceANormalWS3,faceANormalWS3); // Needed?
            //console.log("face normal:",hullA.faceNormals[i].toString(),"world face normal:",faceANormalWS3);
            
            var d = hullA.testSepAxis(faceANormalWS3, hullB, posA, quatA, posB, quatB);
            if(d===false){
            return false;
            }
            
            if(d<dmin){
                dmin = d;
                faceANormalWS3.copy(target);
            }
        }

        // Test normals from hullB
        var numFacesB = hullB.faces.length;
        for(var i=0;i<numFacesB;i++){
            hullB.faceNormals[i].copy(Worldnormal1);
            quatB.vmult(Worldnormal1,Worldnormal1);
            //posB.vadd(Worldnormal1,Worldnormal1);
            //console.log("facenormal",hullB.faceNormals[i].toString(),"world:",Worldnormal1.toString());
            curPlaneTests++;
            var d = hullA.testSepAxis(Worldnormal1, hullB,posA,quatA,posB,quatB);
            if(d===false){
                return false;
            }
            
            if(d<dmin){
                dmin = d;
                Worldnormal1.copy(target);
            }
        }

        var edgeAstart,edgeAend,edgeBstart,edgeBend;
        
        var curEdgeEdge = 0;
        // Test edges
        for(var e0=0; e0<hullA.uniqueEdges.length; e0++){
            // Get world edge
            hullA.uniqueEdges[e0].copy(worldEdge0);
            quatA.vmult(worldEdge0,worldEdge0);
            //posA.vadd(worldEdge0,worldEdge0); // needed?

            //console.log("edge0:",worldEdge0.toString());

            for(var e1=0; e1<hullB.uniqueEdges.length; e1++){
                hullB.uniqueEdges[e1].copy(worldEdge1);
                quatB.vmult(worldEdge1,worldEdge1);
                //posB.vadd(worldEdge1,worldEdge1); // needed?
                //console.log("edge1:",worldEdge1.toString());
                
                worldEdge0.cross(worldEdge1,Cross);
        
                curEdgeEdge++;
                if(!Cross.almostZero()){
                    Cross.normalize();
                    var dist = hullA.testSepAxis( Cross, hullB, posA,quatA,posB,quatB);
                    if(dist===false){
                        return false;
                    }
                    
                    if(dist<dmin){
                        dmin = dist;
                        Cross.copy(target);
                    }
                }
            }
        }

        posB.vsub(posA,deltaC);
        if((deltaC.dot(target))>0.0)
            target.negate(target);
        
        return true;
    }

    /**
     * @method clipAgainstHull
     * @memberof CANNON.ConvexPolyhedron
     * @brief Clip this hull against another hull
     * @param CANNON.Vec3 posA
     * @param CANNON.Quaternion quatA
     * @param CANNON.ConvexPolyhedron hullB
     * @param CANNON.Vec3 posB
     * @param CANNON.Quaternion quatB
     * @param CANNON.Vec3 separatingNormal
     * @param float minDist Clamp distance
     * @param float maxDist
     * @param array result The an array of contact point objects, see clipFaceAgainstHull
     * @see http://bullet.googlecode.com/svn/trunk/src/BulletCollision/NarrowPhaseCollision/btPolyhedralContactClipping.cpp
     */
    var WorldNormal = new CANNON.Vec3();
    this.clipAgainstHull = function(posA,quatA,hullB,posB,quatB,separatingNormal,minDist,maxDist,result){
    if(!(posA instanceof CANNON.Vec3))
        throw new Error("posA must be Vec3");
    if(!(quatA instanceof CANNON.Quaternion))
        throw new Error("quatA must be Quaternion");
    var hullA = this;
    var curMaxDist = maxDist;
    var closestFaceB = -1;
    var dmax = -Infinity;
    for(var face=0; face < hullB.faces.length; face++){
        hullB.faceNormals[face].copy(WorldNormal);
        quatB.vmult(WorldNormal,WorldNormal);
        posB.vadd(WorldNormal,WorldNormal);

        var d = WorldNormal.dot(separatingNormal);
        if (d > dmax){
        dmax = d;
        closestFaceB = face;
        }
    }
    var worldVertsB1 = [];
    polyB = hullB.faces[closestFaceB];
    var numVertices = polyB.length;
    for(var e0=0; e0<numVertices; e0++){
        var b = hullB.vertices[polyB[e0]];
        var worldb = new CANNON.Vec3();
        b.copy(worldb);
        quatB.vmult(worldb,worldb);
        posB.vadd(worldb,worldb);
        worldVertsB1.push(worldb);
    }
    //console.log("--- clipping face: ",worldVertsB1);
    if (closestFaceB>=0)
        this.clipFaceAgainstHull(separatingNormal,
                     posA,
                     quatA,
                     worldVertsB1,
                     minDist,
                     maxDist,
                     result);
    };

    /**
     * @method clipFaceAgainstHull
     * @memberof CANNON.ConvexPolyhedron
     * @brief Clip a face against a hull.
     * @param CANNON.Vec3 separatingNormal
     * @param CANNON.Vec3 posA
     * @param CANNON.Quaternion quatA
     * @param Array worldVertsB1 An array of CANNON.Vec3 with vertices in the world frame.
     * @param float minDist Distance clamping
     * @param float maxDist
     * @param Array result Array to store resulting contact points in. Will be objects with properties: point, depth, normal. These are represented in world coordinates.
     */
    var faceANormalWS = new CANNON.Vec3();
    var edge0 = new CANNON.Vec3();
    var WorldEdge0 = new CANNON.Vec3();
    var worldPlaneAnormal1 = new CANNON.Vec3();
    var planeNormalWS1 = new CANNON.Vec3();
    var worldA1 = new CANNON.Vec3();
    var localPlaneNormal = new CANNON.Vec3();
    var planeNormalWS = new CANNON.Vec3();
    this.clipFaceAgainstHull = function(separatingNormal, posA, quatA, worldVertsB1, minDist, maxDist,result){
        if(!(separatingNormal instanceof CANNON.Vec3))
            throw new Error("sep normal must be vector");
        if(!(worldVertsB1 instanceof Array))
            throw new Error("world verts must be array");
        minDist = Number(minDist);
        maxDist = Number(maxDist);
        var hullA = this;
        var worldVertsB2 = [];
        var pVtxIn = worldVertsB1;
        var pVtxOut = worldVertsB2;
    
        // Find the face with normal closest to the separating axis
        var closestFaceA = -1;
        var dmin = Infinity;
        for(var face=0; face<hullA.faces.length; face++){
            hullA.faceNormals[face].copy(faceANormalWS);
            quatA.vmult(faceANormalWS,faceANormalWS);
            posA.vadd(faceANormalWS,faceANormalWS);
            var d = faceANormalWS.dot(separatingNormal);
            if (d < dmin){
            dmin = d;
            closestFaceA = face;
            }
        }
        if (closestFaceA<0){
            console.log("--- did not find any closest face... ---");
            return;
        }
        //console.log("closest A: ",closestFaceA);
    
        // Get the face and construct connected faces
        var polyA = hullA.faces[closestFaceA];
        polyA.connectedFaces = [];
        for(var i=0; i<hullA.faces.length; i++)
            for(var j=0; j<hullA.faces[i].length; j++)
            if(polyA.indexOf(hullA.faces[i][j])!==-1 && // Sharing a vertex
               i!==closestFaceA && // Not the one we are looking for connections from
               polyA.connectedFaces.indexOf(i)===-1 // Not already added
              )
                polyA.connectedFaces.push(i);
        
        // Clip the polygon to the back of the planes of all faces of hull A, that are adjacent to the witness face
        var numContacts = pVtxIn.length;
        var numVerticesA = polyA.length;
        var res = [];
        for(var e0=0; e0<numVerticesA; e0++){
            var a = hullA.vertices[polyA[e0]];
            var b = hullA.vertices[polyA[(e0+1)%numVerticesA]];
            a.vsub(b,edge0);
            edge0.copy(WorldEdge0);
            quatA.vmult(WorldEdge0,WorldEdge0);
            posA.vadd(WorldEdge0,WorldEdge0);
            this.faceNormals[closestFaceA].copy(worldPlaneAnormal1);//transA.getBasis()* btVector3(polyA.m_plane[0],polyA.m_plane[1],polyA.m_plane[2]);
            quatA.vmult(worldPlaneAnormal1,worldPlaneAnormal1);
            posA.vadd(worldPlaneAnormal1,worldPlaneAnormal1);
            WorldEdge0.cross(worldPlaneAnormal1,planeNormalWS1);
            planeNormalWS1.negate(planeNormalWS1);
            a.copy(worldA1);
            quatA.vmult(worldA1,worldA1);
            posA.vadd(worldA1,worldA1);
            var planeEqWS1 = -worldA1.dot(planeNormalWS1);
            var planeEqWS;
            if(true){
                var otherFace = polyA.connectedFaces[e0];
                this.faceNormals[otherFace].copy(localPlaneNormal);
                var localPlaneEq = planeConstant(otherFace);
                
                localPlaneNormal.copy(planeNormalWS);
                quatA.vmult(planeNormalWS,planeNormalWS);
                //posA.vadd(planeNormalWS,planeNormalWS);
                var planeEqWS = localPlaneEq - planeNormalWS.dot(posA);
            } else  {
                planeNormalWS1.copy(planeNormalWS);
                planeEqWS = planeEqWS1;
            }
    
            // Clip face against our constructed plane
            //console.log("clipping polygon ",printFace(closestFaceA)," against plane ",planeNormalWS, planeEqWS);
            this.clipFaceAgainstPlane(pVtxIn, pVtxOut, planeNormalWS, planeEqWS);
            //console.log(" - clip result: ",pVtxOut);
    
            // Throw away all clipped points, but save the reamining until next clip
            while(pVtxIn.length)  pVtxIn.shift();
            while(pVtxOut.length) pVtxIn.push(pVtxOut.shift());
        }
    
        //console.log("Resulting points after clip:",pVtxIn);
            
        // only keep contact points that are behind the witness face
        this.faceNormals[closestFaceA].copy(localPlaneNormal);
        
        var localPlaneEq = planeConstant(closestFaceA);
        localPlaneNormal.copy(planeNormalWS);
        quatA.vmult(planeNormalWS,planeNormalWS);
        
        var planeEqWS = localPlaneEq - planeNormalWS.dot(posA);
        for (var i=0; i<pVtxIn.length; i++){
            var depth = planeNormalWS.dot(pVtxIn[i]) + planeEqWS; //???
            /*console.log("depth calc from normal=",planeNormalWS.toString()," and constant "+planeEqWS+" and vertex ",pVtxIn[i].toString()," gives "+depth);*/
            if (depth <=minDist){
                console.log("clamped: depth="+depth+" to minDist="+(minDist+""));
                depth = minDist;
            }
            
            if (depth <=maxDist){
                var point = pVtxIn[i];
                if(depth<=0){
                    /*console.log("Got contact point ",point.toString(),
                      ", depth=",depth,
                      "contact normal=",separatingNormal.toString(),
                      "plane",planeNormalWS.toString(),
                      "planeConstant",planeEqWS);*/
                    var p = {
                    point:point,
                    normal:planeNormalWS,
                    depth: depth,
                    };
                    result.push(p);
                }
            }
        }
    }
    
    /**
     * @method clipFaceAgainstPlane
     * @memberof CANNON.ConvexPolyhedron
     * @brief Clip a face in a hull against the back of a plane.
     * @param Array inVertices
     * @param Array outVertices
     * @param CANNON.Vec3 planeNormal
     * @param float planeConstant The constant in the mathematical plane equation
     */
    this.clipFaceAgainstPlane = function(inVertices,outVertices, planeNormal, planeConstant){
        if(!(planeNormal instanceof CANNON.Vec3))
            throw new Error("planeNormal must be Vec3, "+planeNormal+" given");
        if(!(inVertices instanceof Array))
            throw new Error("invertices must be Array, "+inVertices+" given");
        if(!(outVertices instanceof Array))
            throw new Error("outvertices must be Array, "+outVertices+" given");
        var n_dot_first, n_dot_last;
        var numVerts = inVertices.length;
    
        if(numVerts < 2)
            return outVertices;
        
        var firstVertex = inVertices[inVertices.length-1];
        var lastVertex =   inVertices[0];
    
        n_dot_first = planeNormal.dot(firstVertex) + planeConstant;
        
        for(var vi = 0; vi < numVerts; vi++){
            lastVertex = inVertices[vi];
            n_dot_last = planeNormal.dot(lastVertex) + planeConstant;
            if(n_dot_first < 0){
                if(n_dot_last < 0){
                    // Start < 0, end < 0, so output lastVertex
                    var newv = new CANNON.Vec3();
                    lastVertex.copy(newv);
                    outVertices.push(newv);
                } else {
                    // Start < 0, end >= 0, so output intersection
                    var newv = new CANNON.Vec3();
                    firstVertex.lerp(lastVertex,
                             n_dot_first / (n_dot_first - n_dot_last),
                             newv);
                    outVertices.push(newv);
                }
            } else {
                if(n_dot_last<0){
                    // Start >= 0, end < 0 so output intersection and end
                    var newv = new CANNON.Vec3();
                    firstVertex.lerp(lastVertex,
                             n_dot_first / (n_dot_first - n_dot_last),
                             newv);
                    outVertices.push(newv);
                    outVertices.push(lastVertex);
                }
            }
            firstVertex = lastVertex;
            n_dot_first = n_dot_last;
        }
        return outVertices;
    }

    /*
     * Whether the face is visible from the vertex
     * @param array face
     * @param CANNON.Vec3 vertex
     */
    function visible( face, vertex ) {
        var va = that.vertices[ face[ 0 ] ];
        var vb = that.vertices[ face[ 1 ] ];
        var vc = that.vertices[ face[ 2 ] ];
    
        var n = new CANNON.Vec3();
        normal( va, vb, vc, n );
    
        // distance from face to origin
        var dist = n.dot( va );
    
        return n.dot( vertex ) >= dist;
    }

    var that = this;
    function normalOfFace(i,target){
        var f = that.faces[i];
        var va = that.vertices[f[0]];
        var vb = that.vertices[f[1]];
        var vc = that.vertices[f[2]];
        return normal(va,vb,vc,target);
    }

    function planeConstant(face_i,target){
        var f = that.faces[face_i];
        var n = that.faceNormals[face_i];
        var v = that.vertices[f[0]];
        var c = -n.dot(v);
        return c;
    }

    /*
     * @brief Get face normal given 3 vertices
     * @param CANNON.Vec3 va
     * @param CANNON.Vec3 vb
     * @param CANNON.Vec3 vc
     * @param CANNON.Vec3 target
     * @todo unit test?
     */
    var cb = new CANNON.Vec3();
    var ab = new CANNON.Vec3();
    function normal( va, vb, vc, target ) {
        vb.vsub(va,ab);
        vc.vsub(vb,cb);
        cb.cross(ab,target);
        if ( !target.isZero() ) {
            target.normalize();
        }
    }

    function printFace(i){
    var f = that.faces[i], s = "";
    for(var j=0; j<f.length; j++)
        s += " ("+that.vertices[f[j]]+")";
        return s;
    }

    /*
     * Detect whether two edges are equal.
     * Note that when constructing the convex hull, two same edges can only
     * be of the negative direction.
     * @return bool
     */
    function equalEdge( ea, eb ) {
        return ea[ 0 ] === eb[ 1 ] && ea[ 1 ] === eb[ 0 ]; 
    }

    /*
     * Create a random offset between -1e-6 and 1e-6.
     * @return float
     */
    function randomOffset() {
        return ( Math.random() - 0.5 ) * 2 * 1e-6;
    }

    this.calculateLocalInertia = function(mass,target){
        // Approximate with box inertia
        // Exact inertia calculation is overkill, but see http://geometrictools.com/Documentation/PolyhedralMassProperties.pdf for the correct way to do it
        var x = this.aabbmax.x - this.aabbmin.x,
        y = this.aabbmax.y - this.aabbmin.y,
        z = this.aabbmax.z - this.aabbmin.z;
        target.x = 1.0 / 12.0 * mass * ( 2*y*2*y + 2*z*2*z );
        target.y = 1.0 / 12.0 * mass * ( 2*x*2*x + 2*z*2*z );
        target.z = 1.0 / 12.0 * mass * ( 2*y*2*y + 2*x*2*x );
    }

    this.computeAABB = function(){
        var n = this.vertices.length,
        aabbmin = this.aabbmin,
        aabbmax = this.aabbmax,
        vertices = this.vertices;
        aabbmin.set(Infinity,Infinity,Infinity);
        aabbmax.set(-Infinity,-Infinity,-Infinity);
        for(var i=0; i<n; i++){
            var v = vertices[i];
            if     (v.x < aabbmin.x) aabbmin.x = v.x;
            else if(v.x > aabbmax.x) aabbmax.x = v.x;
            if     (v.y < aabbmin.y) aabbmin.y = v.y;
            else if(v.y > aabbmax.y) aabbmax.y = v.y;
            if     (v.z < aabbmin.z) aabbmin.z = v.z;
            else if(v.z > aabbmax.z) aabbmax.z = v.z;
        }
    }

    this.boundingSphereRadius = function(){
        // Assume points are distributed with local (0,0,0) as center
        var max2 = 0;
        for(var i=0; i<this.vertices.length; i++) {
            var norm2 = this.vertices[i].norm2();
            if(norm2>max2)
            max2 = norm2;
        }
        return Math.sqrt(max2);
    }

    this.computeAABB();
};

CANNON.ConvexPolyhedron.prototype = new CANNON.Shape();
CANNON.ConvexPolyhedron.prototype.constructor = CANNON.ConvexPolyhedron;

var tempWorldVertex = new CANNON.Vec3();
CANNON.ConvexPolyhedron.prototype.calculateWorldAABB = function(pos,quat,min,max){
    var n = this.vertices.length, verts = this.vertices;
    var minx,miny,minz,maxx,maxy,maxz;
    for(var i=0; i<n; i++){
        verts[i].copy(tempWorldVertex);
        quat.vmult(tempWorldVertex,tempWorldVertex);
        pos.vadd(tempWorldVertex,tempWorldVertex);
        var v = tempWorldVertex;
        if     (v.x < minx || minx==undefined) minx = v.x;
        else if(v.x > maxx || maxx==undefined) maxx = v.x;
        if     (v.y < miny || miny==undefined) miny = v.y;
        else if(v.y > maxy || maxy==undefined) maxy = v.y;
        if     (v.z < minz || minz==undefined) minz = v.z;
        else if(v.z > maxz || maxz==undefined) maxz = v.z;
    } 
    min.set(minx,miny,minz);
    max.set(maxx,maxy,maxz);
};

CANNON.ConvexPolyhedron.prototype.volume = function(){
    return 4.0 * Math.PI * this.boundingSphereRadius() / 3.0;
};/**
 * @class CANNON.Cylinder
 * @extends CANNON.ConvexPolyhedron
 * @author schteppe / https://github.com/schteppe
 * @param float radiusTop
 * @param float radiusBottom
 * @param float height
 * @param int numSegments The number of segments to build the cylinder out of
 */
CANNON.Cylinder = function( radiusTop, radiusBottom, height , numSegments ) {
    var N = numSegments,
        verts = [],
        normals = [],
        faces = [],
        bottomface = [],
        topface = [],
        cos = Math.cos,
        sin = Math.sin;

    // First bottom point
    verts.push(new CANNON.Vec3(radiusBottom*cos(0),
                               radiusBottom*sin(0),
                               -height*0.5));
    bottomface.push(0);

    // First top point
    verts.push(new CANNON.Vec3(radiusTop*cos(0),
                               radiusTop*sin(0),
                               height*0.5));
    topface.push(1);

    for(var i=0; i<N; i++){
        var theta = 2*Math.PI/N * (i+1);
        var thetaN = 2*Math.PI/N * (i+0.5);
        if(i<N-1){
            // Bottom
            verts.push(new CANNON.Vec3(radiusBottom*cos(theta),
                                       radiusBottom*sin(theta),
                                       -height*0.5));
            bottomface.push(2*(i+1));
            // Top
            verts.push(new CANNON.Vec3(radiusTop*cos(theta),
                                       radiusTop*sin(theta),
                                       height*0.5));
            topface.push(2*(i+1)+1);
            // Normal
            normals.push(new CANNON.Vec3(cos(thetaN),
                                         sin(thetaN),
                                         0));
            // Face
            faces.push([2*i, 2*i+1, 2*(i+1), 2*(i+1)+1]);
        } else {
            faces.push([2*i, 2*i+1, 0, 1]);
          
            // Normal
            normals.push(new CANNON.Vec3(cos(thetaN),sin(thetaN),0));
        }
    } 
    faces.push(topface);
    normals.push(new CANNON.Vec3(0,0,1));
    faces.push(bottomface);
    normals.push(new CANNON.Vec3(0,0,-1));

    this.type = CANNON.Shape.types.CONVEXPOLYHEDRON;
    CANNON.ConvexPolyhedron.call( this, verts, faces, normals );
};

CANNON.Cylinder.prototype = new CANNON.ConvexPolyhedron();/*global CANNON:true */

/**
 * @class CANNON.Solver
 * @brief Constraint equation solver base class.
 * @author schteppe / https://github.com/schteppe
 */
CANNON.Solver = function(){
    // All equations to be solved
    this.equations = [];
};

// Should be implemented in subclasses!
CANNON.Solver.prototype.solve = function(dt,world){
    // Should return the number of iterations done!
    return 0;
};

CANNON.Solver.prototype.addEquation = function(eq){
    this.equations.push(eq);
};

CANNON.Solver.prototype.removeEquation = function(eq){
    var i = this.equations.indexOf(eq);
    if(i!=-1)
        this.equations.splice(i,1);
};

CANNON.Solver.prototype.removeAllEquations = function(){
    this.equations = [];
};

/*global CANNON:true */

/**
 * @class CANNON.Solver
 * @brief Constraint equation Gauss-Seidel solver.
 * @todo The spook parameters should be specified for each constraint, not globally.
 * @author schteppe / https://github.com/schteppe
 * @see https://www8.cs.umu.se/kurser/5DV058/VT09/lectures/spooknotes.pdf
 * @extends CANNON.Solver
 */
CANNON.GSSolver = function(){
    CANNON.Solver.call(this);

    /**
    * @property int iterations
    * @brief The number of solver iterations determines quality of the constraints in the world. The more iterations, the more correct simulation. More iterations need more computations though. If you have a large gravity force in your world, you will need more iterations.
    * @todo write more about solver and iterations in the wiki
    * @memberof CANNON.GSSolver
    */
    this.iterations = 10;

    /**
    * @property float h
    * @brief Time step size. The larger timestep, the less computationally heavy will your simulation be. But watch out, you don't want your bodies to tunnel each instead of colliding!
    * @memberof CANNON.GSSolver
    */
    this.h = 1.0/60.0;

    /**
    * @property float k
    * @brief SPOOK parameter, spring stiffness
    * @memberof CANNON.Solver
    */
    this.k = 1e7;

    /**
    * @property float d
    * @brief SPOOK parameter, similar to damping
    * @memberof CANNON.GSSolver
    */
    this.d = 5;

    /**
    * @property float a
    * @brief SPOOK parameter
    * @memberof CANNON.GSSolver
    */
    this.a = 0.0;

    /**
    * @property float b
    * @brief SPOOK parameter
    * @memberof CANNON.GSSolver
    */
    this.b = 0.0;

    /**
    * @property float eps
    * @brief SPOOK parameter
    * @memberof CANNON.GSSolver
    */
    this.eps = 0.0;

    /**
     * When tolerance is reached, the system is assumed to be converged.
     * @property float tolerance
     */
    this.tolerance = 0;

    this.setSpookParams(this.k,this.d);

    /**
    * @property bool debug
    * @brief Debug flag, will output solver data to console if true
    * @memberof CANNON.GSSolver
    */
    this.debug = false;

    if(this.debug)
        console.log("a:",this.a,"b",this.b,"eps",this.eps,"k",this.k,"d",this.d);
};
CANNON.GSSolver.prototype = new CANNON.Solver();

/**
 * @method setSpookParams
 * @memberof CANNON.GSSolver
 * @brief Sets the SPOOK parameters k and d, and updates the other parameters a, b and eps accordingly.
 * @param float k
 * @param float d
 */
CANNON.GSSolver.prototype.setSpookParams = function(k,d){
    var h=this.h;
    this.k = k;
    this.d = d;
    this.a = 4.0 / (h * (1 + 4 * d));
    this.b = (4.0 * d) / (1 + 4 * d);
    this.eps = 4.0 / (h * h * k * (1 + 4 * d));
};


CANNON.GSSolver.prototype.solve = function(dt,world){

    var d = this.d,
        ks = this.k,
        iter = 0,
        maxIter = this.iterations,
        tol = this.tolerance,
        a = this.a,
        b = this.b,
        eps = this.eps,
        equations = this.equations,
        Neq = equations.length,
        bodies = world.bodies,
        Nbodies = world.bodies.length,
        h = dt;

    // Things that does not change during iteration can be computed once
    var invCs = [];
    var Bs = [];

    // Create array for lambdas
    var lambda = [];
    for(var i=0; i<Neq; i++){
        var c = equations[i];
        lambda.push(0.0);
        Bs.push(c.computeB(a,b,h));
        invCs.push(1.0 / c.computeC(eps));
    }

    var q, B, c, invC, deltalambda, deltalambdaTot, GWlambda;

    if(Neq > 0){

        var i,j,abs=Math.abs;

        // Reset vlambda
        for(i=0; i<Nbodies; i++){
            var b = bodies[i];
            b.vlambda.set(0,0,0);
            if(b.wlambda) b.wlambda.set(0,0,0);
        }

        // Iterate over equations
        for(iter=0; iter<maxIter; iter++){

            // Accumulate the total error for each iteration.
            deltalambdaTot = 0.0;

            for(j=0; j<Neq; j++){

                c = equations[j];

                // Compute iteration
                B = Bs[j];
                invC = invCs[j];
                GWlambda = c.computeGWlambda(eps);
                deltalambda = invC * ( B - GWlambda - eps * lambda[j] );

                if(lambda[j] + deltalambda < c.minForce || lambda[j] + deltalambda > c.maxForce){
                    deltalambda = -lambda[j];
                }
                lambda[j] += deltalambda;

                deltalambdaTot += abs(deltalambda);

                c.addToWlambda(deltalambda);
            }

            // If the total error is small enough - stop iterate
            if(deltalambdaTot < tol) break;
        }

        // Add result to velocity
        for(i=0; i<Nbodies; i++){
            var b = bodies[i];
            b.velocity.vadd(b.vlambda, b.velocity);
            if(b.angularVelocity)
                b.angularVelocity.vadd(b.wlambda, b.angularVelocity);
        }
    }

    errorTot = deltalambdaTot;

    return iter; 
};
/*global CANNON:true */

CANNON.SplitSolver = function(subsolver){
    CANNON.Solver.call(this);
    this.subsolver = subsolver;
};
CANNON.SplitSolver.prototype = new CANNON.Solver();

// Returns the number of subsystems
CANNON.SplitSolver.prototype.solve = function(dt,world){
    var nodes=[],
        bodies=world.bodies,
        equations=this.equations,
        Neq=equations.length,
        Nbodies=bodies.length,
        subsolver=this.subsolver;
    for(var i=0; i<Nbodies; i++)
        nodes.push({ body:bodies[i], children:[], eqs:[], visited:false });
    for(var k=0; k<Neq; k++){
        var eq=equations[k],
            i=bodies.indexOf(eq.bi),
            j=bodies.indexOf(eq.bj),
            ni=nodes[i],
            nj=nodes[j];
        ni.children.push(nj);
        ni.eqs.push(eq);
        nj.children.push(ni);
        nj.eqs.push(eq);
    }

    var STATIC = CANNON.Body.STATIC;
    function getUnvisitedNode(nodes){
        var N = nodes.length;
        for(var i=0; i<N; i++){
            var node = nodes[i];
            if(!node.visited && !(node.body.motionstate & STATIC))
                return node;
        }
        return false;
    }

    function bfs(root,visitFunc){
        var queue = [];
        queue.push(root);
        root.visited = true;
        visitFunc(root);
        while(queue.length) {
            var node = queue.pop();
            // Loop over unvisited child nodes
            var child;
            while((child = getUnvisitedNode(node.children))) {
                child.visited = true;
                visitFunc(child);
                queue.push(child);
            }
        }
    }

    var child, n=0;
    while((child = getUnvisitedNode(nodes))){
        var eqs=[], bds=[];
        bfs(child,function(node){
            bds.push(node.body);
            for(var i=0; i<node.eqs.length; i++)
                if(eqs.indexOf(node.eqs[i]) == -1)
                    eqs.push(node.eqs[i]);
        });

        for(var i=0; i<eqs.length; i++)
            subsolver.addEquation(eqs[i]);

        var iter = subsolver.solve(dt,{bodies:bds});
        subsolver.removeAllEquations();
        n++;
    }

    return n;
};
/*global CANNON:true */

/**
 * @class CANNON.EventTarget
 * @see https://github.com/mrdoob/eventtarget.js/
 */
CANNON.EventTarget = function () {
    var listeners = {};
    this.addEventListener = function ( type, listener ) {
        if ( listeners[ type ] == undefined ) {
            listeners[ type ] = [];
        }
        if ( listeners[ type ].indexOf( listener ) === - 1 ) {
            listeners[ type ].push( listener );
        }
    };
    this.dispatchEvent = function ( event ) {
        for ( var listener in listeners[ event.type ] ) {
            listeners[ event.type ][ listener ]( event );
        }
    };
    this.removeEventListener = function ( type, listener ) {
        var index = listeners[ type ].indexOf( listener );
        if ( index !== - 1 ) {
            listeners[ type ].splice( index, 1 );
        }
    };
};/*global CANNON:true */

/**
 * @class CANNON.ObjectPool
 * @brief For pooling objects that can be reused.
 */
CANNON.ObjectPool = function(){
    this.objects = [];
    this.type = Object;
};

CANNON.ObjectPool.prototype.release = function(){
    for(var i in arguments)
        this.objects.push(arguments[i]);
};

CANNON.ObjectPool.prototype.get = function(){
    if(this.objects.length===0)
        return this.constructObject();
    else
        return this.objects.pop();
};

CANNON.ObjectPool.prototype.constructObject = function(){
    throw new Error("constructObject() not implemented in this ObjectPool subclass yet!");
};/*global CANNON:true */

/**
 * @class CANNON.Vec3Pool
 */
CANNON.Vec3Pool = function(){
    CANNON.ObjectPool.call(this);
    this.type = CANNON.Vec3;
};
CANNON.Vec3Pool.prototype = new CANNON.ObjectPool();

CANNON.Vec3Pool.prototype.constructObject = function(){
    return new CANNON.Vec3();
};/*global CANNON:true */

/**
 * @class CANNON.Material
 * @brief Defines a physics material.
 * @param string name
 * @author schteppe
 */
CANNON.Material = function(name){
    /**
    * @property string name
    * @memberof CANNON.Material
    */
    this.name = name;
    this.id = -1;
};

/*global CANNON:true */

/**
 * @class CANNON.ContactMaterial
 * @brief Defines what happens when two materials meet.
 * @param CANNON.Material m1
 * @param CANNON.Material m2
 * @param float friction
 * @param float restitution
 * @todo Contact solving parameters here too?
 */
CANNON.ContactMaterial = function(m1, m2, friction, restitution){

    /// Contact material index in the world, -1 until added to the world
    this.id = -1;

    /// The two materials participating in the contact
    this.materials = [m1,m2];

    /// Kinetic friction
    this.friction = friction!=undefined ? Number(friction) : 0.3;

    /// Restitution
    this.restitution =      restitution!=undefined ?      Number(restitution) :      0.3;
  
};

/*global CANNON:true */

/**
 * @class CANNON.World
 * @brief The physics world
 */
CANNON.World = function(){

    CANNON.EventTarget.apply(this);

    /// Makes bodies go to sleep when they've been inactive
    this.allowSleep = false;

    /**
     * @property bool enableImpulses
     * @brief Whether to enable impulses or not. This is a quite unstable feature for now.
     * @memberof CANNON.World
     */
    this.enableImpulses = false;

    /**
     * @property int quatNormalizeSkip
     * @brief How often to normalize quaternions. Set to 0 for every step, 1 for every second etc.
     * @memberof CANNON.World
     */
    this.quatNormalizeSkip = 2;

    /**
     * @property bool quatNormalizeFast
     * @brief Whether to use fast quaternion normalization or normal (slower, but more accurate) normalization.
     * @memberof CANNON.World
     * @see CANNON.Quaternion.normalizeFast
     * @see CANNON.Quaternion.normalize
     */
    this.quatNormalizeFast = true;

    /**
     * @property float time
     * @brief The wall-clock time since simulation start
     * @memberof CANNON.World
     */
    this.time = 0.0;

    /**
     * @property int stepnumber
     * @brief Number of timesteps taken since start
     * @memberof CANNON.World
     */
    this.stepnumber = 0;

    /// Default and last timestep sizes
    this.default_dt = 1/60;
    this.last_dt = this.default_dt;

    this.nextId = 0;
    /**
     * @property CANNON.Vec3 gravity
     * @memberof CANNON.World
     */
    this.gravity = new CANNON.Vec3();
    this.broadphase = null;

    /**
     * @property Array bodies
     * @memberof CANNON.World
     */
    this.bodies = [];

    var th = this;

    /**
     * @property CANNON.Solver solver
     * @memberof CANNON.World
     */
    this.solver = new CANNON.GSSolver();

    // User defined constraints
    this.constraints = [];

    // Contact generator
    this.contactgen = new CANNON.ContactGenerator();

    // Collision matrix, size N*N
    this.collision_matrix = [];

    // Materials
    this.materials = []; // References to all added materials
    this.contactmaterials = []; // All added contact materials
    this.mats2cmat = []; // Hash: (mat1_id, mat2_id) => contactmat_id

    this.temp = {
        gvec:new CANNON.Vec3(),
        vi:new CANNON.Vec3(),
        vj:new CANNON.Vec3(),
        wi:new CANNON.Vec3(),
        wj:new CANNON.Vec3(),
        t1:new CANNON.Vec3(),
        t2:new CANNON.Vec3(),
        rixn:new CANNON.Vec3(),
        rjxn:new CANNON.Vec3(),
        step_q:new CANNON.Quaternion(),
        step_w:new CANNON.Quaternion(),
        step_wq:new CANNON.Quaternion()
    };

    this.doProfiling = false;

    // Profiling data in milliseconds
    this.profile = {
        solve:0,
        makeContactConstraints:0,
        broadphase:0,
        integrate:0,
        nearphase:0,
    };
};

/**
 * @method getContactMaterial
 * @memberof CANNON.World
 * @brief Get the contact material between materials m1 and m2
 * @param CANNON.Material m1
 * @param CANNON.Material m2
 * @return CANNON.Contactmaterial The contact material if it was found.
 */
CANNON.World.prototype.getContactMaterial = function(m1,m2){
    if((m1 instanceof CANNON.Material) &&  (m2 instanceof CANNON.Material)){

        var i = m1.id;
        var j = m2.id;

        if(i<j){
            var temp = i;
            i = j;
            j = temp;
        }
        return this.contactmaterials[this.mats2cmat[i+j*this.materials.length]];
    }
};

/**
 * @method _addImpulse
 * @memberof CANNON.World
 * @brief Add an impulse to the colliding bodies i and j
 * @param int i Body number 1
 * @param int i Body number 2
 * @param CANNON.Vec3 ri Vector from body 1's center of mass to the contact point on its surface
 * @param CANNON.Vec3 ri Vector from body 1's center of mass to the contact point on its surface
 * @param CANNON.Vec3 ui The relative velocity eg. vj+wj*rj - (vi+wj*rj)
 * @param CANNON.Vec3 ni The contact normal pointing out from body i.
 * @param float e The coefficient of restitution
 * @param float mu The contact friction
 * @todo Use it in the code!
 */
CANNON.World.prototype.addCollisionImpulse = function(c,e,mu){
    var ri = c.ri,
        rj = c.rj,
        ni = c.ni,
        bi = c.bi
        bj = c.bj;
    var vi = bi.velocity,
        vj = bj.velocity,
        ui = vj.vsub(vi);
    var ri_star = ri.crossmat();
    var rj_star = rj.crossmat();

    // Inverse inertia matrices
    var ii = bi.inertia && bi.inertia.x>0 ? 1.0/bi.inertia.x : 0.0;
    var Iinv_i = new CANNON.Mat3([ii,0,0,
                                  0,ii,0,
                                  0,0,ii]);
    ii = bj.inertia && bj.inertia.x>0 ? 1.0/bj.inertia.x : 0.0;
    var Iinv_j = new CANNON.Mat3([ii,0,0,
                                  0,ii,0,
                                  0,0,ii]);

    // Collision matrix:
    // K = 1/mi + 1/mj - ri_star*I_inv_i*ri_star - rj_star*I_inv_j*rj_star;
    var im = bi.invMass + bj.invMass;
    var K = new CANNON.Mat3([im,0,0,
                             0,im,0,
                             0,0,im]);
    var rIr_i = ri_star.mmult(Iinv_i.mmult(ri_star));
    var rIr_j = rj_star.mmult(Iinv_j.mmult(rj_star));

    // @todo add back when this works
    for(var el = 0; el<9; el++)
        K.elements[el] -= (rIr_i.elements[el] + rIr_j.elements[el]);

    // First assume stick friction
    // Final velocity if stick:
    var v_f = ni.mult(-e * ui.dot(ni));

    var J =  K.solve(v_f.vsub(ui));

    // Check if slide mode (J_t > J_n) - outside friction cone
    if(mu>0){
        var J_n = ni.mult(J.dot(ni));
        var J_t = J.vsub(J_n);
        if(J_t.norm2() > J_n.mult(mu).norm2()){
            // Calculate impulse j = -(1+e)u_n / nK(n-mu*t)
            var v_tang = ui.vsub(ni.mult(ui.dot(ni)));
            var tangent = v_tang.mult(1.0/(v_tang.norm() + 0.0001));
            var impulse = -(1+e)*(ui.dot(ni))/(ni.dot(K.vmult((ni.vsub(tangent.mult(mu))))));
            J = ni.mult(impulse).vsub(tangent.mult(mu * impulse));
        }
    }

    // Add to velocities
    var imi = bi.invMass;
    var imj = bj.invMass;

    if(imi){
        vi.x =  vi.x - J.x * imi;
        vi.y =  vi.y - J.y * imi;
        vi.z =  vi.z - J.z * imi;
    }
    if(imj) {
        vj.x =  vj.x + J.x * imj;
        vj.y =  vj.y + J.y * imj;
        vj.z =  vj.z + J.z * imj;
    }

    if(bi.inertia || bj.inertia){
        // Add rotational impulses
        var wi = bi.angularVelocity,
            wj = bj.angularVelocity;
        if(bi.inertia){
            var cr = ri.cross(J);
            var wadd = cr.mult(bi.inertia.x ? 1.0/bi.inertia.x : 0.0);
            wi.vsub(wadd,wi);
        }
        if(bj.inertia){
            cr = rj.cross(J);
            wadd = cr.mult(bj.inertia.x ? 1.0/bj.inertia.x : 0.0); // @todo fix to suit asymmetric inertia
            wj.vadd(wadd,wj);
        }
    }
};

/**
 * @method numObjects
 * @memberof CANNON.World
 * @brief Get number of objects in the world.
 * @return int
 */
CANNON.World.prototype.numObjects = function(){
  return this.bodies.length;
};

/**
 * @method clearCollisionState
 * @memberof CANNON.World
 * @brief Clear the contact state for a body.
 * @param CANNON.Body body
 */
CANNON.World.prototype.clearCollisionState = function(body){
    var n = this.numObjects();
    var i = body.id;
    for(var idx=0; idx<n; idx++){
        var j = idx;
        if(i>j) cm[j+i*n] = 0;
        else    cm[i+j*n] = 0;
    }
};



// Keep track of contacts for current and previous timestep
// 0: No contact between i and j
// 1: Contact
CANNON.World.prototype.collisionMatrixGet = function(i,j,current){
    var N = this.bodies.length;
    if(typeof(current)=="undefined") current = true;
    // i == column
    // j == row
    if((current && i<j) || // Current uses upper part of the matrix
       (!current && i>j)){ // Previous uses lower part of the matrix
        var temp = j;
        j = i;
        i = temp;
    }
    return this.collision_matrix[i+j*N];
}

CANNON.World.prototype.collisionMatrixSet = function(i,j,value,current){
    var N = this.bodies.length;
    if(typeof(current)==="undefined") current = true;
    if( (current && i<j) || // Current uses upper part of the matrix
        (!current && i>j)){ // Previous uses lower part of the matrix
        var temp = j;
        j = i;
        i = temp;
    }
    this.collision_matrix[i+j*N] = value;
}

// transfer old contact state data to T-1
CANNON.World.prototype.collisionMatrixTick = function(){
    var N = this.bodies.length
    for(var i=0; i<N; i++){
        for(var j=0; j<i; j++){
            var currentState = this.collisionMatrixGet(i,j,true);
            this.collisionMatrixSet(i,j,currentState,false);
            this.collisionMatrixSet(i,j,0,true);
        }
    }
}

/**
 * @method add
 * @memberof CANNON.World
 * @brief Add a rigid body to the simulation.
 * @param CANNON.Body body
 * @todo If the simulation has not yet started, why recrete and copy arrays for each body? Accumulate in dynamic arrays in this case.
 * @todo Adding an array of bodies should be possible. This would save some loops too
 */
CANNON.World.prototype.add = function(body){
    var n = this.numObjects();
    this.bodies.push(body);
    body.id = this.id();
    body.world = this;
    body.position.copy(body.initPosition);
    body.velocity.copy(body.initVelocity);
    if(body instanceof CANNON.RigidBody){
        body.angularVelocity.copy(body.initAngularVelocity);
        body.quaternion.copy(body.initQuaternion);
    }
    
    // Increase size of collision matrix to (n+1)*(n+1)=n*n+2*n+1 elements, it was n*n last.
    for(var i=0; i<2*n+1; i++)
        this.collision_matrix.push(0);
    //this.collision_matrix = new Int16Array((n+1)*(n+1));
};

/**
 * @method addConstraint
 * @memberof CANNON.World
 * @brief Add a constraint to the simulation.
 * @param CANNON.Constraint c
 */
CANNON.World.prototype.addConstraint = function(c){
    this.constraints.push(c);
    c.id = this.id();
};

/**
 * @method removeConstraint
 * @memberof CANNON.World
 * @brief Removes a constraint
 * @param CANNON.Constraint c
 */
CANNON.World.prototype.removeConstraint = function(c){
    var idx = this.constraints.indexOf(c);
    if(idx!=-1)
        this.constraints.splice(idx,1);
};

/**
 * @method id
 * @memberof CANNON.World
 * @brief Generate a new unique integer identifyer
 * @return int
 */
CANNON.World.prototype.id = function(){
  return this.nextId++;
};

/**
 * @method remove
 * @memberof CANNON.World
 * @brief Remove a rigid body from the simulation.
 * @param CANNON.Body body
 */
CANNON.World.prototype.remove = function(body){
    body.world = null;
    var n = this.numObjects();
    var bodies = this.bodies;
    for(var i in bodies)
        if(bodies[i].id == body.id)
            bodies.splice(i,1);


    // Reduce size of collision matrix to (n-1)*(n-1)=n*n-2*n+1 elements, it was n*n last.
    for(var i=0; i<2*n-1; i++)
        this.collision_matrix.pop();

    // Reset collision matrix
    //this.collision_matrix = new Int16Array((n-1)*(n-1));
};

/**
 * @method addMaterial
 * @memberof CANNON.World
 * @brief Adds a material to the World. A material can only be added once, it's added more times then nothing will happen.
 * @param CANNON.Material m
 */
CANNON.World.prototype.addMaterial = function(m){
    if(m.id==-1){
        var n = this.materials.length;
        this.materials.push(m);
        m.id = this.materials.length-1;

        if(true){
            // Increase size of collision matrix to (n+1)*(n+1)=n*n+2*n+1 elements, it was n*n last.
            for(var i=0; i<2*n+1; i++)
                this.mats2cmat.push(-1);
            //this.mats2cmat[];
        } else {
            // Enlarge matrix
            var newcm = new Int16Array((this.materials.length) * (this.materials.length));
            for(var i=0; i<newcm.length; i++)
                newcm[i] = -1;

            // Copy over old values
            for(var i=0; i<this.materials.length-1; i++)
                for(var j=0; j<this.materials.length-1; j++)
                    newcm[i+this.materials.length*j] = this.mats2cmat[i+(this.materials.length-1)*j];
            this.mats2cmat = newcm;
        }
    }
};

/**
 * @method addContactMaterial
 * @memberof CANNON.World
 * @brief Adds a contact material to the World
 * @param CANNON.ContactMaterial cmat
 */
CANNON.World.prototype.addContactMaterial = function(cmat) {

  // Add materials if they aren't already added
  this.addMaterial(cmat.materials[0]);
  this.addMaterial(cmat.materials[1]);

  // Save (material1,material2) -> (contact material) reference for easy access later
  // Make sure i>j, ie upper right matrix
  if(cmat.materials[0].id > cmat.materials[1].id){
    i = cmat.materials[0].id;
    j = cmat.materials[1].id;
  } else {
    j = cmat.materials[0].id;
    i = cmat.materials[1].id;
  }
    
  // Add contact material
  this.contactmaterials.push(cmat);
  cmat.id = this.contactmaterials.length-1;

  // Add current contact material to the material table
  this.mats2cmat[i+this.materials.length*j] = cmat.id; // index of the contact material
};

CANNON.World.prototype._now = function(){
    if(window.performance.webkitNow)
        return window.performance.webkitNow();
    else
        return Date.now();
}

/**
 * @method step
 * @memberof CANNON.World
 * @brief Step the simulation
 * @param float dt
 */
CANNON.World.prototype.step = function(dt){
    var world = this,
        that = this,
        N = this.numObjects(),
        bodies = this.bodies,
        solver = this.solver,
        gravity = this.gravity,
        doProfiling = this.doProfiling,
        profile = this.profile,
        DYNAMIC = CANNON.Body.DYNAMIC,
        now = this._now,
        profilingStart,
        cm = this.collision_matrix,
        constraints = this.constraints,
        FrictionEquation = CANNON.FrictionEquation;

    if(doProfiling) profilingStart = now();

    if(dt==undefined){
        if(this.last_dt) dt = this.last_dt;
        else             dt = this.default_dt;
    }

    // Add gravity to all objects
    var gx = gravity.x,
        gy = gravity.y,
        gz = gravity.z;
    for(var i=0; i<N; i++){
        var bi = bodies[i];
        if(bi.motionstate & DYNAMIC){ // Only for dynamic bodies
            var f = bi.force, m = bi.mass;
            f.x += m*gx;
            f.y += m*gy;
            f.z += m*gz;
        }
    }

    // 1. Collision detection
    if(doProfiling) profilingStart = now();
    var pairs = this.broadphase.collisionPairs(this);
    var p1 = pairs[0];
    var p2 = pairs[1];
    if(doProfiling) profile.broadphase = now() - profilingStart;

    this.collisionMatrixTick();

    // Generate contacts
    if(doProfiling) profilingStart = now();
    var oldcontacts = this.contacts;
    this.contacts = [];
    this.contactgen.getContacts(p1,p2,
                                this,
                                this.contacts,
                                oldcontacts // To be reused
                                );
    if(doProfiling) profile.nearphase = now() - profilingStart;

    // Loop over all collisions
    if(doProfiling) profilingStart = now();
    var temp = this.temp;
    var contacts = this.contacts;
    var ncontacts = contacts.length;
    for(var k=0; k<ncontacts; k++){

        // Current contact
        var c = contacts[k];


        // Get current collision indeces
        var bi=c.bi, bj=c.bj;

        // Resolve indeces
        var i = bodies.indexOf(bi), j = bodies.indexOf(bj);

        // Get collision properties
        var mu = 0.3, e = 0.2;
        var cm = this.getContactMaterial(bi.material,bj.material);
        if(cm){
            mu = cm.friction;
            e = cm.restitution;
        }
          
        // g = ( xj + rj - xi - ri ) .dot ( ni )
        var gvec = temp.gvec;
        gvec.set(bj.position.x + c.rj.x - bi.position.x - c.ri.x,
                 bj.position.y + c.rj.y - bi.position.y - c.ri.y,
                 bj.position.z + c.rj.z - bi.position.z - c.ri.z);
        var g = gvec.dot(c.ni); // Gap, negative if penetration

        // Action if penetration
        if(g<0.0){
            c.penetration = g;
            solver.addEquation(c);

            // Add friction constraint equation
            if(mu > 0){

                // Create 2 tangent equations
                var mug = mu*gravity.norm();
                var reducedMass = (bi.invMass + bj.invMass);
                if(reducedMass != 0) reducedMass = 1/reducedMass;
                var c1 = new FrictionEquation(bi,bj,mug*reducedMass);
                var c2 = new FrictionEquation(bi,bj,mug*reducedMass);

                // Copy over the relative vectors
                c.ri.copy(c1.ri);
                c.rj.copy(c1.rj);
                c.ri.copy(c2.ri);
                c.rj.copy(c2.rj);

                // Construct tangents
                c.ni.tangents(c1.t,c2.t);

                // Add equations to solver
                solver.addEquation(c1);
                solver.addEquation(c2);
            }

            // Now we know that i and j are in contact. Set collision matrix state
            this.collisionMatrixSet(i,j,1,true);

            if(this.collisionMatrixGet(i,j,true)!=this.collisionMatrixGet(i,j,false)){
                // First contact!
                bi.dispatchEvent({type:"collide", "with":bj});
                bj.dispatchEvent({type:"collide", "with":bi});
                bi.wakeUp();
                bj.wakeUp();
                if(this.enableImpulses)
                    this.addCollisionImpulse(c,e,mu);
            }
        }
    }
    if(doProfiling) profile.makeContactConstraints = now() - profilingStart;

    var bi;

    if(doProfiling) profilingStart = now();
    
    // Add user-added constraints
    for(var i=0; i<constraints.length; i++){
        var c = constraints[i];
        c.update();
        for(var name in c.equations){
            var eq = c.equations[name];
            solver.addEquation(eq);
        }
    }

    // Solve the constrained system
    solver.solve(dt,world);

    if(doProfiling) profile.solve = now() - profilingStart;

    // Remove all contacts from solver
    solver.removeAllEquations();

    // Apply damping, see http://code.google.com/p/bullet/issues/detail?id=74 for details
    var pow = Math.pow;
    for(var i=0; i<N; i++){
        bi = bodies[i];
        if(bi.motionstate & DYNAMIC){ // Only for dynamic bodies
            var ld = pow(1.0 - bi.linearDamping,dt);
            var v = bi.velocity;
            v.mult(ld,v);
	    var av = bi.angularVelocity;
            if(av){	
		var ad = pow(1.0 - bi.angularDamping,dt);
                av.mult(ad,av);
	    }
        }
    }

    that.dispatchEvent({type:"preStep"});

    // Invoke pre-step callbacks
    for(var i=0; i<N; i++){
        var bi = bodies[i];
        bi.preStep && bi.preStep.call(bi);
    }

    // Leap frog
    // vnew = v + h*f/m
    // xnew = x + h*vnew
    if(doProfiling) profilingStart = now();
    var q = temp.step_q; 
    var w = temp.step_w;
    var wq = temp.step_wq;
    var stepnumber = world.stepnumber;
    var DYNAMIC_OR_KINEMATIC = CANNON.Body.DYNAMIC | CANNON.Body.KINEMATIC;
    var quatNormalize = stepnumber % (this.quatNormalizeSkip+1) === 0;
    var quatNormalizeFast = this.quatNormalizeFast;
    var half_dt = dt * 0.5;
    for(var i=0; i<N; i++){
        var b = bodies[i],
            force = b.force,
            tau = b.tau;
        if((b.motionstate & DYNAMIC_OR_KINEMATIC)){ // Only for dynamic
            var velo = b.velocity,
                angularVelo = b.angularVelocity,
                pos = b.position,
                quat = b.quaternion,
                invMass = b.invMass,
                invInertia = b.invInertia;
            velo.x += force.x * invMass * dt;
            velo.y += force.y * invMass * dt;
            velo.z += force.z * invMass * dt;
          
            if(b.angularVelocity){
                angularVelo.x += tau.x * invInertia.x * dt;
                angularVelo.y += tau.y * invInertia.y * dt;
                angularVelo.z += tau.z * invInertia.z * dt;
            }
          
            // Use new velocity  - leap frog
            if(!b.isSleeping()){
                pos.x += velo.x * dt;
                pos.y += velo.y * dt;
                pos.z += velo.z * dt;

                if(b.angularVelocity){
                    w.set(  angularVelo.x, angularVelo.y, angularVelo.z, 0);
                    w.mult(quat,wq);
                    quat.x += half_dt * wq.x;
                    quat.y += half_dt * wq.y;
                    quat.z += half_dt * wq.z;
                    quat.w += half_dt * wq.w;
                    if(quatNormalize){
                        if(quatNormalizeFast)
                            quat.normalizeFast();
                        else
                            quat.normalize();
                    }
                }
            }
        }
        b.force.set(0,0,0);
        if(b.tau) b.tau.set(0,0,0);
    }
    if(doProfiling) profile.integrate = now() - profilingStart;

    // Update world time
    world.time += dt;
    world.stepnumber += 1;

    that.dispatchEvent({type:"postStep"});

    // Invoke post-step callbacks
    for(var i=0; i<N; i++){
        var bi = bodies[i];
        var postStep = bi.postStep;
        postStep && postStep.call(bi);
    }

    // Update world inertias
    for(var i=0; i<N; i++){
        var b = bodies[i];
        if(b.inertiaWorldAutoUpdate)
            b.quaternion.vmult(b.inertia,b.inertiaWorld);
        if(b.invInertiaWorldAutoUpdate)
            b.quaternion.vmult(b.invInertia,b.invInertiaWorld);
    }

    // Sleeping update
    if(world.allowSleep){
        for(var i=0; i<N; i++){
           bodies[i].sleepTick();
        }
    }
};
/**
 * @class CANNON.ContactPoint
 * @brief A contact point between two bodies.
 * @description Should be generated by the ContactGenerator.
 * @param CANNON.Body bi
 * @param CANNON.Body bj
 */
CANNON.ContactPoint = function(bi, bj, normalConstraint, contactMaterial, tangentConstraint1, tangentConstraint2){
    this.bi = bi;
    this.bj = bj;
    this.n = normalConstraint;
    this.t1 = tangentConstraint1;
    this.t2 = tangentConstraint2;
    this.contactMaterial = contactMaterial;
};/*global CANNON:true */

/**
 * @class CANNON.ContactGenerator
 * @brief Helper class for the World. Generates ContactPoints.
 * @todo Sphere-ConvexPolyhedron contacts
 * @todo Contact reduction
 */
CANNON.ContactGenerator = function(){

    /**
     * @property bool contactReduction
     * @memberof CANNON.ContactGenerator
     * @brief Turns on or off contact reduction. Can be handy to turn off when debugging new collision types.
     */
    this.contactReduction = false;

    // Contact point objects that can be reused
    var contactPointPool = [];

    var v3pool = new CANNON.Vec3Pool();

    // temp vertices for plane/polyhedron collision tests
    var tempverts = [new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3(),
                     new CANNON.Vec3()];
    // temp normals for plane/polyhedron
    var tempnormals = [new CANNON.Vec3(),
                       new CANNON.Vec3(),
                       new CANNON.Vec3(),
                       new CANNON.Vec3(),
                       new CANNON.Vec3(),
                       new CANNON.Vec3()];

    var planehull = new CANNON.ConvexPolyhedron(tempverts,
                                                [
                                                    [0,1,2,3], // -z
                                                    [4,5,6,7], // +z
                                                    [0,1,4,5], // -y
                                                    [2,3,6,7], // +y
                                                    [0,3,4,7], // -x
                                                    [1,2,5,6], // +x
                                                ],
                                                tempnormals);
    
    /*
     * Near phase calculation, get the contact point, normal, etc.
     * @param array result The result one will get back with all the contact point information
     * @param Shape si Colliding shape. If not given, particle is assumed.
     * @param Shape sj
     * @param Vec3 xi Position of the center of mass
     * @param Vec3 xj
     * @param Quaternion qi Rotation around the center of mass
     * @param Quaternion qj
     * @todo All collision cases
     */
    function nearPhase(result,si,sj,xi,xj,qi,qj,bi,bj){
        var swapped = false;
        if(si && sj){
            if(si.type>sj.type){
                var temp;
                temp=sj;   sj=si;   si=temp;
                temp=xj;   xj=xi;   xi=temp;
                temp=qj;   qj=qi;   qi=temp;
                temp=bj;   bj=bi;   bi=temp;
                swapped = true;
            }
        } else {
            // Particle!
        }

        /*
         * Make a contact object.
         * @return object
         * @todo reuse old contact point objects
         */
        function makeResult(bi,bj){
            if(contactPointPool.length){
                var c = contactPointPool.pop();
                c.bi = bi;
                c.bj = bj;
                return c;
            } else
                return new CANNON.ContactEquation(bi,bj);
        }

        /*
         * Swaps the body references in the contact
         * @param object r
         */
        function swapResult(r){
            var temp;
            temp = r.ri; r.ri = r.rj; r.rj = temp;
            r.ni.negate(r.ni);
            temp = r.bi; r.bi = r.bj; r.bj = temp;
        }

        /*
         * Go recursive for compound shapes
         * @param Shape si
         * @param CompoundShape sj
         */
        function recurseCompound(result,si,sj,xi,xj,qi,qj,bi,bj){
            for(var i=0; i<sj.childShapes.length; i++){
                var r = [];
                nearPhase(r,
                          si,
                          sj.childShapes[i],
                          xi,
                          xj.vadd(qj.vmult(sj.childOffsets[i])), // Transform the shape to its local frame
                          qi,
                          qj.mult(sj.childOrientations[i]),
                          bi,
                          bj);
                // Transform back
                for(var j=0; j<r.length; j++){
                    r[j].rj.vadd(qj.vmult(sj.childOffsets[i]),r[j].rj);
                    result.push(r[j]);
                }
            }
        }

        if(si && sj){
            if(si.type==CANNON.Shape.types.SPHERE){
                if(sj.type==CANNON.Shape.types.SPHERE){ // sphere-sphere

                    // We will have one contact in this case
                    var r = makeResult(bi,bj);

                    // Contact normal
                    xj.vsub(xi,r.ni);
                    r.ni.normalize();

                    // Contact point locations
                    r.ni.copy(r.ri);
                    r.ni.copy(r.rj);
                    r.ri.mult(si.radius,r.ri);
                    r.rj.mult(-sj.radius,r.rj);
                    result.push(r);

                } else if(sj.type==CANNON.Shape.types.PLANE){ // sphere-plane

                    // We will have one contact in this case
                    var r = makeResult(bi,bj);

                    // Contact normal
                    //sj.normal.copy(r.ni);
                    r.ni.set(0,0,1);
                    qj.vmult(r.ni,r.ni);
                    r.ni.negate(r.ni); // body i is the sphere, flip normal
                    r.ni.normalize();

                    // Vector from sphere center to contact point
                    r.ni.mult(si.radius,r.ri);

                    // Project down sphere on plane
                    var point_on_plane_to_sphere = xi.vsub(xj);
                    var plane_to_sphere_ortho = r.ni.mult(r.ni.dot(point_on_plane_to_sphere));
                    r.rj = point_on_plane_to_sphere.vsub(plane_to_sphere_ortho); // The sphere position projected to plane
                    if(plane_to_sphere_ortho.norm() <= si.radius)
                    result.push(r);
                    
                } else if(sj.type==CANNON.Shape.types.BOX){ // sphere-box

                    // we refer to the box as body j
                    var box_to_sphere =  xi.vsub(xj);
                    var sides = sj.getSideNormals(true,qj);
                    var R =     si.radius;
                    var penetrating_sides = [];

                    // Check side (plane) intersections
                    var found = false;
                    for(var idx=0; idx<sides.length && !found; idx++){ // Max 3 penetrating sides
                        var ns = sides[idx].copy();
                        var h = ns.norm();
                        ns.normalize();
                        var dot = box_to_sphere.dot(ns);
                        if(dot<h+R && dot>0){
                            // Intersects plane. Now check the other two dimensions
                            var ns1 = sides[(idx+1)%3].copy();
                            var ns2 = sides[(idx+2)%3].copy();
                            var h1 = ns1.norm();
                            var h2 = ns2.norm();
                            ns1.normalize();
                            ns2.normalize();
                            var dot1 = box_to_sphere.dot(ns1);
                            var dot2 = box_to_sphere.dot(ns2);
                            if(dot1<h1 && dot1>-h1 && dot2<h2 && dot2>-h2){
                                found = true;
                                var r = makeResult(bi,bj);
                                ns.mult(-R,r.ri); // Sphere r
                                ns.copy(r.ni);
                                r.ni.negate(r.ni); // Normal should be out of sphere
                                ns.mult(h).vadd(ns1.mult(dot1)).vadd(ns2.mult(dot2),r.rj); // box
                                result.push(r);
                            }
                        }
                    }

                    // Check corners
                    var rj = v3pool.get();
                    for(var j=0; j<2 && !found; j++){
                        for(var k=0; k<2 && !found; k++){
                            for(var l=0; l<2 && !found; l++){
                                rj.set(0,0,0);
                                if(j) rj.vadd(sides[0],rj);
                                else  rj.vsub(sides[0],rj);
                                if(k) rj.vadd(sides[1],rj);
                                else  rj.vsub(sides[1],rj);
                                if(l) rj.vadd(sides[2],rj);
                                else  rj.vsub(sides[2],rj);

                                // World position of corner
                                var sphere_to_corner = xj.vadd(rj).vsub(xi);
                                if(sphere_to_corner.norm()<R){
                                    found = true;
                                    var r = makeResult(bi,bj);
                                    sphere_to_corner.copy(r.ri);
                                    r.ri.normalize();
                                    r.ri.copy(r.ni);
                                    r.ri.mult(R,r.ri);
                                    rj.copy(r.rj);
                                    result.push(r);
                                }
                            }
                        }
                    }
                    v3pool.release(rj);
                    rj = null;

                    // Check edges
                    var edgeTangent = v3pool.get();
                    var edgeCenter = v3pool.get();
                    var r = v3pool.get(); // r = edge center to sphere center
                    var orthogonal = v3pool.get();
                    var dist = v3pool.get();
                    for(var j=0; j<sides.length && !found; j++){
                        for(var k=0; k<sides.length && !found; k++){
                            if(j%3!=k%3){
                                // Get edge tangent
                                sides[k].cross(sides[j],edgeTangent);
                                edgeTangent.normalize();
                                sides[j].vadd(sides[k], edgeCenter);
                                xi.copy(r);
                                r.vsub(edgeCenter,r);
                                r.vsub(xj,r);
                                var orthonorm = r.dot(edgeTangent); // distance from edge center to sphere center in the tangent direction
                                edgeTangent.mult(orthonorm,orthogonal); // Vector from edge center to sphere center in the tangent direction
                                
                                // Find the third side orthogonal to this one
                                var l = 0;
                                while(l==j%3 || l==k%3) l++;

                                // vec from edge center to sphere projected to the plane orthogonal to the edge tangent
                                xi.copy(dist);
                                dist.vsub(orthogonal,dist);
                                dist.vsub(edgeCenter,dist);
                                dist.vsub(xj,dist);

                                // Distances in tangent direction and distance in the plane orthogonal to it
                                var tdist = Math.abs(orthonorm);
                                var ndist = dist.norm();
                                
                                if(tdist < sides[l].norm() && ndist<R){
                                    found = true;
                                    var res = makeResult(bi,bj);
                                    edgeCenter.vadd(orthogonal,res.rj); // box rj
                                    res.rj.copy(res.rj);
                                    dist.negate(res.ni);
                                    res.ni.normalize();

                                    res.rj.copy(res.ri);
                                    res.ri.vadd(xj,res.ri);
                                    res.ri.vsub(xi,res.ri);
                                    res.ri.normalize();
                                    res.ri.mult(R,res.ri);

                                    result.push(res);
                                }
                            }
                        }
                    }
                    v3pool.release(edgeTangent,edgeCenter,r,orthogonal,dist);

                } else if(sj.type==CANNON.Shape.types.COMPOUND){ // sphere-compound
                    recurseCompound(result,si,sj,xi,xj,qi,qj,bi,bj);

                } else if(sj.type==CANNON.Shape.types.CONVEXPOLYHEDRON){ // sphere-convexpolyhedron
                    throw new Error("sphere/convexpolyhedron contacts not implemented yet.");
                }
            
            } else if(si.type==CANNON.Shape.types.PLANE){
                
                if(sj.type==CANNON.Shape.types.PLANE){ // plane-plane
                    throw "Plane-plane collision... wait, you did WHAT?";
                    
                } else if(sj.type==CANNON.Shape.types.BOX){ // plane-box

                    // Collision normal
                    var n = new CANNON.Vec3(0,0,1); //si.normal.copy();
                    qi.vmult(n,n);

                    // Loop over corners
                    var numcontacts = 0;
                    var corners = sj.getCorners(qj);
                    for(var idx=0; idx<corners.length && numcontacts<=4; idx++){ // max 4 corners against plane
                        var r = makeResult(bi,bj);
                        var worldCorner = corners[idx].vadd(xj);
                        corners[idx].copy(r.rj);

                        // Project down corner to plane to get xj
                        var point_on_plane_to_corner = worldCorner.vsub(xi);
                        var d = n.dot(point_on_plane_to_corner);
                        if(d<=0){
                            numcontacts++;
                            var plane_to_corner = n.mult(d);
                            point_on_plane_to_corner.vsub(plane_to_corner,r.ri);
                            
                            // Set contact normal
                            n.copy(r.ni);
                            
                            // Add contact
                            result.push(r);
                        }
                    }
                    
                } else if(sj.type==CANNON.Shape.types.COMPOUND){ // plane-compound
                    recurseCompound(result,si,sj,xi,xj,qi,qj,bi,bj);

                } else if(sj.type==CANNON.Shape.types.CONVEXPOLYHEDRON){ // plane-convex polyhedron
                    // Separating axis is the plane normal
                    // Create a virtual box polyhedron for the plane
                    var t1 = v3pool.get();
                    var t2 = v3pool.get();
                    //si.normal.tangents(t1,t2);
                    t1.set(1,0,0);
                    t2.set(0,1,0);
                    qi.vmult(t1,t1); // Rotate the tangents
                    qi.vmult(t2,t2);
                    t1.mult(100000,t1);
                    t2.mult(100000,t2);
                    var n = v3pool.get();
                    n.set(0,0,1);
                    qi.vmult(n,n);

                    planehull.vertices[0].set(-t1.x -t2.x -n.x, -t1.y -t2.y -n.y, -t1.z -t2.z -n.z); //---
                    planehull.vertices[1].set( t1.x -t2.x +0*n.x,  t1.y -t2.y +0*n.y,  t1.z -t2.z +0*n.z); // +-+
                    planehull.vertices[2].set( t1.x +t2.x -n.x,  t1.y +t2.y -n.y,  t1.z +t2.z -n.z); // ++- 
                    planehull.vertices[3].set(-t1.x +t2.x -n.x, -t1.y +t2.y -n.y, -t1.z +t2.z -n.z); // -+-
                    planehull.vertices[4].set(-t1.x -t2.x +0*n.x, -t1.y -t2.y +0*n.y, -t1.z -t2.z +0*n.z); // --+
                    planehull.vertices[5].set(+t1.x -t2.x +0*n.x,  t1.y -t2.y +0*n.y,  t1.z -t2.z +0*n.z); // +-+
                    planehull.vertices[6].set(+t1.x +t2.x +0*n.x, +t1.y +t2.y +0*n.y,  t1.z +t2.z +0*n.z); // +++
                    planehull.vertices[7].set(-t1.x +t2.x +0*n.x, -t1.y +t2.y +0*n.y, -t1.z +t2.z +0*n.z); // -++
                    t1.normalize();
                    t2.normalize();
                    planehull.faceNormals[0].set( -n.x, -n.y, -n.z);
                    planehull.faceNormals[1].set(  n.x,  n.y,  n.z);
                    planehull.faceNormals[2].set(-t2.x,-t2.y,-t2.z);
                    planehull.faceNormals[3].set( t2.x, t2.y, t2.z);
                    planehull.faceNormals[4].set(-t1.x,-t1.y,-t1.z);
                    planehull.faceNormals[5].set( t1.x, t1.y, t1.z);
                    
                    var sepAxis = v3pool.get();
                    n.negate(sepAxis);
                    var q = v3pool.get();
                    if(sj.testSepAxis(sepAxis,planehull,xj,qj,xi,qi)!==false){
                        var res = [];
                        planehull.clipAgainstHull(xi,qi,sj,xj,qj,sepAxis,-100,100,res);
                        for(var j=0; j<res.length; j++){
                            var r = makeResult(bi,bj);
                            sepAxis.negate(r.ni);
                            res[j].normal.negate(q);
                            q.mult(res[j].depth,q);
                            r.ri.set(res[j].point.x + q.x,
                                     res[j].point.y + q.y,
                                     res[j].point.z + q.z);
                            r.rj.set(res[j].point.x,
                                     res[j].point.y,
                                     res[j].point.z);
                            // Contact points are in world coordinates. Transform back to relative
                            r.rj.vsub(xj,r.rj);
                            r.ri.vsub(xi,r.ri);
                            result.push(r);
                        }
                    }
                    v3pool.release(q,t1,t2,sepAxis,n);
                }

            } else if(si.type==CANNON.Shape.types.BOX){
                
                if(sj.type==CANNON.Shape.types.BOX){ // box-box
                    // Do convex polyhedron instead
                    nearPhase(result,
                              si.convexPolyhedronRepresentation,
                              sj.convexPolyhedronRepresentation,
                              xi,xj,qi,qj,bi,bj);

                } else if(sj.type==CANNON.Shape.types.COMPOUND){ // box-compound
                    recurseCompound(result,si,sj,xi,xj,qi,qj,bi,bj);
                    
                } else if(sj.type==CANNON.Shape.types.CONVEXPOLYHEDRON){ // box-convexpolyhedron
                    nearPhase(result,
                              si.convexPolyhedronRepresentation,
                              sj,xi,xj,qi,qj,bi,bj);
                }
            
            } else if(si.type==CANNON.Shape.types.COMPOUND){
                
                if(sj.type==CANNON.Shape.types.COMPOUND){ // compound-compound
                    recurseCompound(result,si,sj,xi,xj,qi,qj,bi,bj);
                    
                } else if(sj.type==CANNON.Shape.types.CONVEXPOLYHEDRON){ // compound-convex polyhedron
                    recurseCompound(result,sj,si,xj,xi,qj,qi,bj,bi);    
                }

            } else if(si.type==CANNON.Shape.types.CONVEXPOLYHEDRON){

                if(sj.type==CANNON.Shape.types.CONVEXPOLYHEDRON){ // convex polyhedron - convex polyhedron
                    var sepAxis = new CANNON.Vec3();
                    if(si.findSeparatingAxis(sj,xi,qi,xj,qj,sepAxis)){
                        var res = [];
                        var q = new CANNON.Vec3();
                        si.clipAgainstHull(xi,qi,sj,xj,qj,sepAxis,-100,100,res);
                        for(var j=0; j<res.length; j++){
                            var r = makeResult(bi,bj);
                            sepAxis.negate(r.ni);
                            res[j].normal.negate(q);
                            q.mult(res[j].depth,q);
                            r.ri.set(res[j].point.x + q.x,
                                     res[j].point.y + q.y,
                                     res[j].point.z + q.z);
                            r.rj.set(res[j].point.x,
                                     res[j].point.y,
                                     res[j].point.z);
                            // Contact points are in world coordinates. Transform back to relative
                            r.rj.vsub(xj,r.rj);
                            r.ri.vsub(xi,r.ri);
                            result.push(r);
                        }
                    }
                }
            }
        } else {
            // Particle!
            var particle = si ? bj : bi;
            var other = si ? bi : bj;
            var otherShape = other.shape;
            var type = otherShape.type;

            if(type == CANNON.Shape.types.PLANE){ // Particle vs plane
                var normal = new CANNON.Vec3(0,0,1); // todo: cache
                other.quaternion.vmult(normal,normal); // Turn normal according to plane orientation
                var relpos = new CANNON.Vec3(); // todo: cache
                particle.position.vsub(other.position,relpos);
                var dot = normal.dot(relpos);
                if(dot<=0.0){
                    var r = makeResult(particle,other);
                    normal.copy( r.ni ); // Contact normal is the plane normal
                    r.ni.negate(r.ni);
                    r.ri.set(0,0,0); // Center of particle

                    // Get particle position projected on plane
                    var projected = new CANNON.Vec3(); // todo: cache
                    normal.mult(normal.dot(particle.position),projected);
                    particle.position.vsub(projected,projected);
                    //projected.vadd(other.position,projected);

                    // rj is now the projected world position minus plane position
                    projected.copy(r.rj);
                    result.push(r);
                }
            } else if(type == CANNON.Shape.types.SPHERE){ // Particle vs sphere

                // The normal is the unit vector from sphere center to particle center
                var normal = new CANNON.Vec3(0,0,1); // todo: cache
                particle.position.vsub(other.position,normal);
                var lengthSquared = normal.norm2();

                if(lengthSquared <= Math.pow(otherShape.radius,2)){
                    var r = makeResult(particle,other);
                    normal.normalize();
                    normal.copy(r.rj);
                    r.rj.mult(otherShape.radius,r.rj);
                    normal.copy( r.ni ); // Contact normal
                    r.ni.negate(r.ni);
                    r.ri.set(0,0,0); // Center of particle
                    result.push(r);
                }
            }
        }
    
        // Swap back if we swapped bodies in the beginning
        for(var i=0; swapped && i<result.length; i++)
            swapResult(result[i]);
    }

    /**
     * @method reduceContacts
     * @memberof CANNON.ContactGenerator
     * @brief Removes unnecessary members of an array of CANNON.ContactPoint.
     */
    this.reduceContacts = function(contacts){
    
    }

    /**
     * @method getContacts
     * @memberof CANNON.ContactGenerator
     * @param array p1 Array of body indices
     * @param array p2 Array of body indices
     * @param CANNON.World world
     * @param array result Array to store generated contacts
     * @param array oldcontacts Optional. Array of reusable contact objects
     */
    this.getContacts = function(p1,p2,world,result,oldcontacts){
    
        // Save old contact objects
        for(var i=0; oldcontacts && i<oldcontacts.length; i++)
            contactPointPool.push(oldcontacts[i]);

        for(var k=0; k<p1.length; k++){
            // Get current collision indeces
            var bi = p1[k],
            bj = p2[k];

            // Get contacts
            nearPhase(  result,
                        bi.shape,
                        bj.shape,
                        bi.position,
                        bj.position,
                        bi.quaternion,
                        bj.quaternion,
                        bi,
                        bj
                        );
        }
    }
};/*global CANNON:true */

/**
 * @class CANNON.Equation
 * @brief Equation base class
 * @author schteppe
 */
CANNON.Equation = function(bi,bj,minForce,maxForce){
  this.id = -1;
  this.minForce = typeof(minForce)=="undefined" ? -1e6 : minForce;
  this.maxForce = typeof(maxForce)=="undefined" ? 1e6 : maxForce;
  this.bi = bi;
  this.bj = bj;
};
CANNON.Equation.prototype.constructor = CANNON.Equation;
/**
 * @class CANNON.ContactEquation
 * @brief Contact/non-penetration constraint equation
 * @author schteppe
 * @param CANNON.RigidBody bj
 * @param CANNON.RigidBody bi
 * @extends CANNON.Equation
 */
CANNON.ContactEquation = function(bi,bj){
    CANNON.Equation.call(this,bi,bj,0,1e6);
    this.penetration = 0.0;
    this.ri = new CANNON.Vec3();
    this.penetrationVec = new CANNON.Vec3();
    this.rj = new CANNON.Vec3();
    this.ni = new CANNON.Vec3();
    this.rixn = new CANNON.Vec3();
    this.rjxn = new CANNON.Vec3();
    this.rixw = new CANNON.Vec3();
    this.rjxw = new CANNON.Vec3();

    this.invIi = new CANNON.Mat3();
    this.invIj = new CANNON.Mat3();

    this.relVel = new CANNON.Vec3();
    this.relForce = new CANNON.Vec3();
};

CANNON.ContactEquation.prototype = new CANNON.Equation();
CANNON.ContactEquation.prototype.constructor = CANNON.ContactEquation;

CANNON.ContactEquation.prototype.computeB = function(a,b,h){
    var bi = this.bi;
    var bj = this.bj;
    var ri = this.ri;
    var rj = this.rj;
    var rixn = this.rixn;
    var rjxn = this.rjxn;

    var vi = bi.velocity;
    var wi = bi.angularVelocity ? bi.angularVelocity : new CANNON.Vec3();
    var fi = bi.force;
    var taui = bi.tau ? bi.tau : new CANNON.Vec3();

    var vj = bj.velocity;
    var wj = bj.angularVelocity ? bj.angularVelocity : new CANNON.Vec3();
    var fj = bj.force;
    var tauj = bj.tau ? bj.tau : new CANNON.Vec3();

    var relVel = this.relVel;
    var relForce = this.relForce;
    var penetrationVec = this.penetrationVec;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;

    var invIi = this.invIi;
    var invIj = this.invIj;

    if(bi.invInertia) invIi.setTrace(bi.invInertia);
    else              invIi.identity(); // ok?
    if(bj.invInertia) invIj.setTrace(bj.invInertia);
    else              invIj.identity(); // ok?

    var n = this.ni;

    // Caluclate cross products
    ri.cross(n,rixn);
    rj.cross(n,rjxn);

    // Calculate q = xj+rj -(xi+ri) i.e. the penetration vector
    var penetrationVec = this.penetrationVec;
    penetrationVec.set(0,0,0);
    penetrationVec.vadd(bj.position,penetrationVec);
    penetrationVec.vadd(rj,penetrationVec);
    penetrationVec.vsub(bi.position,penetrationVec);
    penetrationVec.vsub(ri,penetrationVec);

    var Gq = n.dot(penetrationVec);//-Math.abs(this.penetration);

    // Compute iteration
    var GW = vj.dot(n) - vi.dot(n) + wj.dot(rjxn) - wi.dot(rixn);
    var GiMf = fj.dot(n)*invMassj - fi.dot(n)*invMassi + rjxn.dot(invIj.vmult(tauj)) - rixn.dot(invIi.vmult(taui)) ;

    var B = - Gq * a - GW * b - h*GiMf;

    return B;
};

// Compute C = GMG+eps in the SPOOK equation
CANNON.ContactEquation.prototype.computeC = function(eps){
    var bi = this.bi;
    var bj = this.bj;
    var rixn = this.rixn;
    var rjxn = this.rjxn;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;

    var C = invMassi + invMassj + eps;

    var invIi = this.invIi;
    var invIj = this.invIj;

    if(bi.invInertia) invIi.setTrace(bi.invInertia);
    else              invIi.identity(); // ok?
    if(bj.invInertia) invIj.setTrace(bj.invInertia);
    else              invIj.identity(); // ok?

    // Compute rxn * I * rxn for each body
    C += invIi.vmult(rixn).dot(rixn);
    C += invIj.vmult(rjxn).dot(rjxn);


    return C;
};

CANNON.ContactEquation.prototype.computeGWlambda = function(){
    var bi = this.bi;
    var bj = this.bj;

    var GWlambda = 0.0;
    var ulambda = bj.vlambda.vsub(bi.vlambda);
    GWlambda += ulambda.dot(this.ni);

    // Angular
    if(bi.wlambda)
        GWlambda -= bi.wlambda.dot(this.rixn);
    if(bj.wlambda)
        GWlambda += bj.wlambda.dot(this.rjxn);

    return GWlambda;
};

CANNON.ContactEquation.prototype.addToWlambda = function(deltalambda){
    var bi = this.bi;
    var bj = this.bj;
    var rixn = this.rixn;
    var rjxn = this.rjxn;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;
    var n = this.ni;

    // Add to linear velocity
    bi.vlambda.vsub(n.mult(invMassi * deltalambda),bi.vlambda);
    bj.vlambda.vadd(n.mult(invMassj * deltalambda),bj.vlambda);

    // Add to angular velocity
    if(bi.wlambda){
        var I = this.invIi;
        bi.wlambda.vsub(I.vmult(rixn).mult(deltalambda),bi.wlambda);
    }
    if(bj.wlambda){
        var I = this.invIj;
        bj.wlambda.vadd(I.vmult(rjxn).mult(deltalambda),bj.wlambda);
    }
};
/**
 * @class CANNON.FrictionEquation
 * @brief Constrains the slipping in a contact along a tangent
 * @author schteppe
 * @param CANNON.RigidBody bi
 * @param CANNON.RigidBody bj
 * @param float slipForce should be +-F_friction = +-mu * F_normal = +-mu * m * g
 * @extends CANNON.Equation
 */
CANNON.FrictionEquation = function(bi,bj,slipForce){
    CANNON.Equation.call(this,bi,bj,-slipForce,slipForce);
    this.ri = new CANNON.Vec3();
    this.penetrationVec = new CANNON.Vec3();
    this.rj = new CANNON.Vec3();
    this.t = new CANNON.Vec3(); // tangent

    this.rixt = new CANNON.Vec3();
    this.rjxt = new CANNON.Vec3();
    this.wixri = new CANNON.Vec3();
    this.wjxrj = new CANNON.Vec3();

    this.invIi = new CANNON.Mat3();
    this.invIj = new CANNON.Mat3();

    this.relVel = new CANNON.Vec3();
    this.relForce = new CANNON.Vec3();
};

CANNON.FrictionEquation.prototype = new CANNON.Equation();
CANNON.FrictionEquation.prototype.constructor = CANNON.FrictionEquation;

CANNON.FrictionEquation.prototype.computeB = function(a,b,h){
    var bi = this.bi;
    var bj = this.bj;
    var ri = this.ri;
    var rj = this.rj;
    var rixt = this.rixt;
    var rjxt = this.rjxt;
    var wixri = this.wixri;
    var wjxrj = this.wjxrj;

    var vi = bi.velocity;
    var wi = bi.angularVelocity ? bi.angularVelocity : new CANNON.Vec3();
    var fi = bi.force;
    var taui = bi.tau ? bi.tau : new CANNON.Vec3();

    var vj = bj.velocity;
    var wj = bj.angularVelocity ? bj.angularVelocity : new CANNON.Vec3();
    var fj = bj.force;
    var tauj = bj.tau ? bj.tau : new CANNON.Vec3();

    var relVel = this.relVel;
    var relForce = this.relForce;
    var penetrationVec = this.penetrationVec;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;

    var invIi = this.invIi;
    var invIj = this.invIj;

    if(bi.invInertia) invIi.setTrace(bi.invInertia);
    if(bj.invInertia) invIj.setTrace(bj.invInertia);

    var t = this.t;

    // Caluclate cross products
    ri.cross(t,rixt);
    rj.cross(t,rjxt);

    wi.cross(ri,wixri);
    wj.cross(rj,wjxrj);

    var Gq = 0; // we do only want to constrain motion
    var GW = vj.dot(t) - vi.dot(t) + wjxrj.dot(t) - wixri.dot(t); // eq. 40
    var GiMf = fj.dot(t)*invMassj - fi.dot(t)*invMassi + rjxt.dot(invIj.vmult(tauj)) - rixt.dot(invIi.vmult(taui));

    var B = - Gq * a - GW * b - h*GiMf;

    return B;
};

// Compute C = G * Minv * G + eps
CANNON.FrictionEquation.prototype.computeC = function(eps){
    var bi = this.bi;
    var bj = this.bj;
    var rixt = this.rixt;
    var rjxt = this.rjxt;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;

    var C = invMassi + invMassj + eps;

    var invIi = this.invIi;
    var invIj = this.invIj;

    if(bi.invInertia) invIi.setTrace(bi.invInertia);
    if(bj.invInertia) invIj.setTrace(bj.invInertia);

    // Compute rxt * I * rxt for each body
    C += invIi.vmult(rixt).dot(rixt);
    C += invIj.vmult(rjxt).dot(rjxt);

    return C;
};

CANNON.FrictionEquation.prototype.computeGWlambda = function(){

    // Correct at all ???
    
    var bi = this.bi;
    var bj = this.bj;

    var GWlambda = 0.0;
    var ulambda = bj.vlambda.vsub(bi.vlambda);
    GWlambda += ulambda.dot(this.t);

    // Angular
    if(bi.wlambda)
        GWlambda -= bi.wlambda.dot(this.rixt);
    if(bj.wlambda)
        GWlambda += bj.wlambda.dot(this.rjxt);

    return GWlambda;
};

CANNON.FrictionEquation.prototype.addToWlambda = function(deltalambda){
    var bi = this.bi;
    var bj = this.bj;
    var rixt = this.rixt;
    var rjxt = this.rjxt;
    var invMassi = bi.invMass;
    var invMassj = bj.invMass;
    var t = this.t;

    // Add to linear velocity
    bi.vlambda.vsub(t.mult(invMassi * deltalambda),bi.vlambda);
    bj.vlambda.vadd(t.mult(invMassj * deltalambda),bj.vlambda);

    // Add to angular velocity
    if(bi.wlambda){
        var I = this.invIi;
        bi.wlambda.vsub(I.vmult(rixt).mult(deltalambda),bi.wlambda);
    }
    if(bj.wlambda){
        var I = this.invIj;
        bj.wlambda.vadd(I.vmult(rjxt).mult(deltalambda),bj.wlambda);
    }
};/**
 * @class CANNON.DistanceConstraint
 * @brief Distance constraint class
 * @author schteppe
 * @param CANNON.Body bodyA
 * @param CANNON.Body bodyB Could optionally be a CANNON.Vec3 to constrain a body to a static point in space
 * @param float distance
 */
CANNON.DistanceConstraint = function(bodyA,bodyB,distance,maxForce){
    if(typeof(maxForce)=="undefined" )
        maxForce = 1e6;

    // Equations to be fed to the solver
    var eqs = this.equations = {
        normal: new CANNON.ContactEquation(bodyA,bodyB),
    };

    var normal = eqs.normal;

    normal.minForce = -maxForce;
    normal.maxForce =  maxForce;

    // Update 
    this.update = function(){
        bodyB.position.vsub(bodyA.position,normal.ni);
        normal.ni.normalize();
        /*bodyA.quaternion.vmult(pivotA,normal.ri);
        bodyB.quaternion.vmult(pivotB,normal.rj);*/
        normal.ni.mult( distance*0.5,normal.ri);
        normal.ni.mult( -distance*0.5,normal.rj);
    };
};
/*global CANNON:true */

/**
 * @class CANNON.PointToPointConstraint
 * @brief Connects two bodies at given offset points
 * @author schteppe
 * @param CANNON.Body bodyA
 * @param CANNON.Vec3 pivotA The point relative to the center of mass of bodyA which bodyA is constrained to.
 * @param CANNON.Body bodyB Optional. If specified, pivotB must also be specified, and bodyB will be constrained in a similar way to the same point as bodyA. We will therefore get sort of a link between bodyA and bodyB. If not specified, bodyA will be constrained to a static point.
 * @param CANNON.Vec3 pivotB Optional. See pivotA.
 */
CANNON.PointToPointConstraint = function(bodyA,pivotA,bodyB,pivotB,maxForce){
    // Equations to be fed to the solver
    var eqs = this.equations = {
        normal: new CANNON.ContactEquation(bodyA,bodyB),
        tangent1: new CANNON.ContactEquation(bodyA,bodyB),
        tangent2: new CANNON.ContactEquation(bodyA,bodyB),
    };

    var normal = eqs.normal;
    var t1 = eqs.tangent1;
    var t2 = eqs.tangent2;

    t1.minForce = t2.minForce = normal.minForce = -maxForce;
    t1.maxForce = t2.maxForce = normal.maxForce =  maxForce;

    // Update 
    this.update = function(){
        bodyB.position.vsub(bodyA.position,normal.ni);
        normal.ni.normalize();
        bodyA.quaternion.vmult(pivotA,normal.ri);
        bodyB.quaternion.vmult(pivotB,normal.rj);

        normal.ni.tangents(t1.ni,t2.ni);
        normal.ri.copy(t1.ri);
        normal.rj.copy(t1.rj);
        normal.ri.copy(t2.ri);
        normal.rj.copy(t2.rj);
    };
};
if (typeof module !== 'undefined') {
    // export for node
    module.exports = CANNON;
} else {
    // assign to window
    this.CANNON = CANNON;
}

}).apply(this);