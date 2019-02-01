<?php
/**
 * Widget Updater REST API: WP_REST_Widget_Updater_Controller class
 *
 * @package gutenberg
 * @since 4.9.0
 */

/**
 * Controller which provides REST endpoint for updating a widget.
 *
 * @since 2.8.0
 *
 * @see WP_REST_Controller
 */
class WP_REST_Widget_Updater_Controller extends WP_REST_Controller {

	/**
	 * Constructs the controller.
	 *
	 * @access public
	 */
	public function __construct() {
		$this->namespace = 'wp/v2';
		$this->rest_base = 'widgets';
	}

	/**
	 * Registers the necessary REST API route.
	 *
	 * @access public
	 */
	public function register_routes() {
			register_rest_route(
				$this->namespace,
				// Regex representing a PHP class extracted from http://php.net/manual/en/language.oop5.basic.php.
				'/' . $this->rest_base . '/(?P<identifier>[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/',
				array(
					'args' => array(
						'identifier' => array(
							'description' => __( 'Class name of the widget.', 'gutenberg' ),
							'type'        => 'string',
						),
					),
					array(
						'methods'  => WP_REST_Server::EDITABLE,
						'callback' => array( $this, 'compute_new_widget' ),
					),
				)
			);
	}

	/**
	 * Returns the new widget instance and the form that represents it.
	 *
	 * @since 2.8.0
	 * @access public
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
	 */
	public function compute_new_widget( $request ) {
		$url_params = $request->get_url_params();

		$widget = $request->get_param( 'identifier' );

		global $wp_widget_factory;

		if ( null === $widget || ! isset( $wp_widget_factory->widgets[ $widget ] ) ) {
			return;
		}

		$widget_obj = $wp_widget_factory->widgets[ $widget ];
		if ( ! ( $widget_obj instanceof WP_Widget ) ) {
			return;
		}

		$instance = $request->get_param( 'instance' );
		if ( null === $instance ) {
			$instance = array();
		}
		$id_to_use = $request->get_param( 'id_to_use' );
		if ( null === $id_to_use ) {
			$id_to_use = -1;
		}

		$widget_obj->_set( $id_to_use );
		ob_start();

		$instance_changes = $request->get_param( 'instance_changes' );
		if ( null !== $instance_changes ) {
			$instance = $widget_obj->update( $instance_changes, $instance );
			// TODO: apply required filters.
		}

		$widget_obj->form( $instance );
		// TODO: apply required filters.

		$id_base = $widget_obj->id_base;
		$id = $widget_obj->id;
		$form = ob_get_clean();

		return rest_ensure_response(
			array(
				'instance' => $instance,
				'form'     => $form,
				'id_base'  => $id_base,
				'id'       => $id,
			)
		);
	}
}
